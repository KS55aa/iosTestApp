#![allow(
    non_snake_case,
    non_camel_case_types,
    non_upper_case_globals,
    clippy::missing_safety_doc
)]

use idevice::core_device_proxy::CoreDeviceProxy;
use idevice::dvt::message::{AuxValue, Message};
use idevice::dvt::remote_server::{Channel, RemoteServerClient};
use idevice::heartbeat::HeartbeatClient;
use idevice::lockdown::LockdownClient;
use idevice::mobile_image_mounter::ImageMounter;
use idevice::pairing_file::PairingFile;
use idevice::provider::{IdeviceProvider, TcpProvider};
use idevice::rsd::RsdHandshake;
use idevice::{IdeviceService, ReadWrite, RsdService};
use serde::{Deserialize, Serialize};
use serde_json::{Value, json};
use sha2::{Digest, Sha384};
use std::ffi::{CStr, CString, c_char};
use std::path::Path;
use std::sync::{
    Arc, Mutex, OnceLock,
    atomic::{AtomicU64, Ordering},
};
use std::time::{Duration, SystemTime, UNIX_EPOCH};
use tokio::io::AsyncReadExt;
use tokio::runtime::Runtime;
use tokio::sync::{mpsc, oneshot};
use tokio::task::JoinHandle;
use tokio::time::timeout;

#[derive(Clone, Copy, Debug, Deserialize, Serialize, PartialEq)]
struct coordinates {
    latitude: f64,
    longitude: f64,
}

impl coordinates {
    fn validate(self) -> engineResult<Self> {
        if !self.latitude.is_finite()
            || !self.longitude.is_finite()
            || self.latitude.abs() > 90.0
            || self.longitude.abs() > 180.0
        {
            return Err(engineError::new(
                "invalidCoordinates",
                "Ungültige Koordinaten.",
            ));
        }
        Ok(self)
    }
}

#[derive(Clone, Debug, Serialize)]
struct engineError {
    code: String,
    message: String,
}

type engineResult<T> = Result<T, engineError>;

impl engineError {
    fn new(code: &str, message: &str) -> Self {
        Self {
            code: code.into(),
            message: message.into(),
        }
    }
}

#[derive(Clone, Debug, Serialize)]
struct engineState {
    phase: String,
    lastCoordinates: Option<coordinates>,
    lastConfirmedAt: Option<u64>,
    lastHeartbeatAt: Option<u64>,
    requiresReset: bool,
    deviceVersion: Option<String>,
}

impl Default for engineState {
    fn default() -> Self {
        Self {
            phase: "disconnected".into(),
            lastCoordinates: None,
            lastConfirmedAt: None,
            lastHeartbeatAt: None,
            requiresReset: false,
            deviceVersion: None,
        }
    }
}

#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
struct engineRequest {
    operation: String,
    latitude: Option<f64>,
    longitude: Option<f64>,
    imageDirectory: Option<String>,
}

struct sessionCommand {
    target: Option<coordinates>,
    response: oneshot::Sender<engineResult<()>>,
}

struct taskGuard<T>(JoinHandle<T>);

impl<T> Drop for taskGuard<T> {
    fn drop(&mut self) {
        self.0.abort();
    }
}

struct deviceSession {
    commands: mpsc::Sender<sessionCommand>,
    task: taskGuard<()>,
    heartbeatAt: Arc<AtomicU64>,
    deviceVersion: String,
}

#[derive(Default)]
struct locationEngine {
    session: Option<deviceSession>,
    state: engineState,
}

static engineRuntime: OnceLock<Result<Runtime, String>> = OnceLock::new();
static sharedEngine: OnceLock<Mutex<locationEngine>> = OnceLock::new();

fn timestamp() -> u64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_millis() as u64
}

fn supportedVersion(version: &str) -> bool {
    let mut parts = version.split('.');
    let major = parts.next().and_then(|part| part.parse::<u32>().ok());
    let minor = parts.next().and_then(|part| part.parse::<u32>().ok());
    matches!((major, minor), (Some(17), Some(4..)) | (Some(18), Some(_)))
}

fn parsePairing(data: &[u8]) -> engineResult<PairingFile> {
    if data.is_empty() || data.len() > 2 * 1024 * 1024 {
        return Err(engineError::new(
            "pairingMissing",
            "Importiere eine gültige Pairing-Datei für dieses iPhone.",
        ));
    }
    PairingFile::from_bytes(data).map_err(|_| engineError::new(
        "pairingInvalid", "Die Datei ist kein gültiger Lockdown-Pairing-Datensatz. Exportiere ihn mit idevice_pair."))
}

async fn bounded<T>(
    seconds: u64,
    future: impl std::future::Future<Output = Result<T, idevice::IdeviceError>>,
    code: &str,
    message: &str,
) -> engineResult<T> {
    timeout(Duration::from_secs(seconds), future)
        .await
        .map_err(|_| {
            engineError::new(
                "connectionTimeout",
                "Zeitüberschreitung. Prüfe LocalDevVPN, WLAN und die Geräteentsperrung.",
            )
        })?
        .map_err(|_| engineError::new(code, message))
}

async fn readLimited(path: &Path, maxSize: u64) -> engineResult<Vec<u8>> {
    let metadata = tokio::fs::metadata(path).await
        .map_err(|_| engineError::new("developerImageMissing", "Importiere Image.dmg, Image.dmg.trustcache und BuildManifest.plist oder mounte das Developer Disk Image einmal am Computer."))?;
    if !metadata.is_file() || metadata.len() == 0 || metadata.len() > maxSize {
        return Err(engineError::new(
            "developerImageInvalid",
            "Die Developer-Image-Datei ist leer oder zu groß.",
        ));
    }
    tokio::fs::read(path).await.map_err(|_| {
        engineError::new(
            "developerImageUnreadable",
            "Das Developer Disk Image konnte nicht gelesen werden.",
        )
    })
}

fn checkUploadStatus(value: &plist::Value, expected: &str) -> engineResult<()> {
    if value
        .as_dictionary()
        .and_then(|dict| dict.get("Status"))
        .and_then(|item| item.as_string())
        == Some(expected)
    {
        Ok(())
    } else {
        Err(engineError::new(
            "developerImageUploadFailed",
            "iOS hat die Übertragung des Developer Disk Images abgelehnt.",
        ))
    }
}

async fn writePlist(connection: &mut idevice::Idevice, value: &plist::Value) -> engineResult<()> {
    let mut data = Vec::new();
    plist::to_writer_xml(&mut data, value).map_err(|_| {
        engineError::new(
            "imageProtocolFailed",
            "Die Image-Anfrage konnte nicht kodiert werden.",
        )
    })?;
    let mut packet = (data.len() as u32).to_be_bytes().to_vec();
    packet.extend(data);
    connection.send_raw(&packet).await.map_err(|_| {
        engineError::new(
            "imageProtocolFailed",
            "Die Image-Anfrage konnte nicht übertragen werden.",
        )
    })
}

async fn readPlist(connection: &mut idevice::Idevice) -> engineResult<plist::Value> {
    let length = connection
        .read_raw(4)
        .await
        .map_err(|_| engineError::new("imageProtocolFailed", "Die Image-Antwort fehlt."))?;
    let length =
        u32::from_be_bytes(length.as_slice().try_into().map_err(|_| {
            engineError::new("imageProtocolFailed", "Die Image-Antwort ist ungültig.")
        })?) as usize;
    if length == 0 || length > 2 * 1024 * 1024 {
        return Err(engineError::new(
            "imageProtocolFailed",
            "Die Image-Antwort hat eine ungültige Länge.",
        ));
    }
    let data = connection.read_raw(length).await.map_err(|_| {
        engineError::new(
            "imageProtocolFailed",
            "Die Image-Antwort ist unvollständig.",
        )
    })?;
    plist::from_bytes(&data)
        .map_err(|_| engineError::new("imageProtocolFailed", "Die Image-Antwort ist ungültig."))
}

async fn mountImage(
    provider: &TcpProvider,
    mounter: &mut ImageMounter,
    imageDirectory: &Path,
    chipId: u64,
) -> engineResult<()> {
    let manifestData = readLimited(
        &imageDirectory.join("buildManifest.plist"),
        16 * 1024 * 1024,
    )
    .await?;
    let trustCache = readLimited(
        &imageDirectory.join("image.dmg.trustcache"),
        16 * 1024 * 1024,
    )
    .await?;
    let manifest: plist::Dictionary = plist::from_bytes(&manifestData).map_err(|_| {
        engineError::new("developerImageInvalid", "BuildManifest.plist ist ungültig.")
    })?;
    let imagePath = imageDirectory.join("image.dmg");
    let mut imageFile = tokio::fs::File::open(&imagePath).await.map_err(|_| {
        engineError::new(
            "developerImageMissing",
            "Image.dmg fehlt. Importiere alle drei Dateien des Developer Disk Images.",
        )
    })?;
    let imageSize = imageFile
        .metadata()
        .await
        .map_err(|_| engineError::new("developerImageUnreadable", "Image.dmg ist nicht lesbar."))?
        .len();
    if imageSize == 0 || imageSize > 2 * 1024 * 1024 * 1024 {
        return Err(engineError::new(
            "developerImageInvalid",
            "Image.dmg ist leer oder größer als 2 GB.",
        ));
    }
    let mut chunk = vec![0u8; 64 * 1024];
    let mut hasher = Sha384::new();
    loop {
        let count = imageFile.read(&mut chunk).await.map_err(|_| {
            engineError::new(
                "developerImageUnreadable",
                "Image.dmg konnte nicht gelesen werden.",
            )
        })?;
        if count == 0 {
            break;
        }
        hasher.update(&chunk[..count]);
    }
    let imageHash = hasher.finalize().to_vec();
    let ticket = match mounter
        .query_personalization_manifest("DeveloperDiskImage", imageHash)
        .await
    {
        Ok(ticket) => ticket,
        Err(_) => {
            *mounter = ImageMounter::connect(provider).await.map_err(|_| {
                engineError::new(
                    "developerImageConnectionFailed",
                    "Die Image-Mounter-Verbindung wurde getrennt.",
                )
            })?;
            mounter.get_manifest_from_tss(&manifest, chipId).await.map_err(|_| engineError::new(
                "personalizationFailed", "Apple konnte das Developer Disk Image nicht personalisieren. Prüfe Internetverbindung und Image-Kompatibilität."))?
        }
    };
    let mut request = plist::Dictionary::new();
    request.insert("Command".into(), "ReceiveBytes".into());
    request.insert("ImageType".into(), "Personalized".into());
    request.insert("ImageSize".into(), imageSize.into());
    request.insert("ImageSignature".into(), plist::Value::Data(ticket.clone()));
    let mut uploadLockdown = LockdownClient::connect(provider).await.map_err(|_| {
        engineError::new(
            "developerImageConnectionFailed",
            "Die Upload-Verbindung konnte nicht geöffnet werden.",
        )
    })?;
    let legacy = uploadLockdown
        .start_session(&provider.pairing_file)
        .await
        .map_err(|_| {
            engineError::new(
                "pairingRejected",
                "Die Upload-Verbindung konnte nicht authentifiziert werden.",
            )
        })?;
    let (port, useSsl) = uploadLockdown
        .start_service(ImageMounter::service_name())
        .await
        .map_err(|_| {
            engineError::new(
                "developerImageConnectionFailed",
                "Der Image-Uploader ist nicht verfügbar.",
            )
        })?;
    let mut uploader = provider.connect(port).await.map_err(|_| {
        engineError::new(
            "developerImageConnectionFailed",
            "Der Image-Uploader ist nicht erreichbar.",
        )
    })?;
    if useSsl {
        uploader
            .start_session(&provider.pairing_file, legacy)
            .await
            .map_err(|_| {
                engineError::new("pairingRejected", "Die Upload-TLS-Sitzung wurde abgelehnt.")
            })?;
    }
    writePlist(&mut uploader, &plist::Value::Dictionary(request)).await?;
    let response = readPlist(&mut uploader).await?;
    checkUploadStatus(&response, "ReceiveBytesAck")?;
    imageFile = tokio::fs::File::open(imagePath).await.map_err(|_| {
        engineError::new(
            "developerImageUnreadable",
            "Image.dmg ist nicht mehr verfügbar.",
        )
    })?;
    let mut uploadedSize = 0u64;
    loop {
        let count = imageFile.read(&mut chunk).await.map_err(|_| {
            engineError::new(
                "developerImageUnreadable",
                "Image.dmg konnte nicht gelesen werden.",
            )
        })?;
        if count == 0 {
            break;
        }
        uploadedSize += count as u64;
        if uploadedSize > imageSize {
            return Err(engineError::new(
                "developerImageChanged",
                "Das Developer Disk Image wurde während des Uploads geändert.",
            ));
        }
        uploader.send_raw(&chunk[..count]).await.map_err(|_| {
            engineError::new(
                "developerImageUploadFailed",
                "Die Image-Übertragung wurde unterbrochen.",
            )
        })?;
    }
    if uploadedSize != imageSize {
        return Err(engineError::new(
            "developerImageChanged",
            "Das Developer Disk Image ist unvollständig.",
        ));
    }
    let response = readPlist(&mut uploader).await?;
    checkUploadStatus(&response, "Complete")?;
    *mounter = <ImageMounter as IdeviceService>::from_stream(uploader)
        .await
        .map_err(|_| {
            engineError::new(
                "developerImageConnectionFailed",
                "Die Mount-Verbindung wurde getrennt.",
            )
        })?;
    mounter
        .mount_image("Personalized", ticket, Some(trustCache), None)
        .await
        .map_err(|_| {
            engineError::new(
                "developerImageMountFailed",
                "iOS hat das Developer Disk Image abgelehnt. Verwende ein kompatibles Image.",
            )
        })?;
    mounter.lookup_image("Personalized").await.map_err(|_| {
        engineError::new(
            "developerImageMountFailed",
            "Das Developer Disk Image wurde nach dem Mounten nicht gefunden.",
        )
    })?;
    Ok(())
}

fn validateReply(reply: &Message) -> engineResult<()> {
    let header = reply.message_header.serialize();
    let conversation = u32::from_le_bytes(header[20..24].try_into().unwrap());
    let messageType = reply.payload_header.serialize()[0];
    if conversation != 1
        || !matches!(messageType, 0 | 3)
        || reply.data.is_some()
        || reply.raw_data.as_ref().is_some_and(|data| !data.is_empty())
        || reply.aux.as_ref().is_some_and(|aux| !aux.values.is_empty())
    {
        return Err(engineError::new(
            "dvtRejected",
            "Der DVT-Dienst hat den Standortbefehl nicht erfolgreich bestätigt.",
        ));
    }
    Ok(())
}

async fn sendLocation(
    channel: &mut Channel<'_, Box<dyn ReadWrite>>,
    target: Option<coordinates>,
) -> engineResult<()> {
    let (selector, arguments) = match target {
        Some(target) => (
            "simulateLocationWithLatitude:longitude:",
            Some(vec![
                AuxValue::archived_value(target.latitude),
                AuxValue::archived_value(target.longitude),
            ]),
        ),
        None => ("stopLocationSimulation", None),
    };
    bounded(
        10,
        channel.call_method(Some(selector), arguments, true),
        "dvtWriteFailed",
        "Der DVT-Standortbefehl konnte nicht übertragen werden.",
    )
    .await?;
    let reply = bounded(
        10,
        channel.read_message(),
        "dvtReadFailed",
        "Die DVT-Verbindung wurde vor der Bestätigung getrennt.",
    )
    .await?;
    validateReply(&reply)
}

async fn openSession(pairing: PairingFile, imageDirectory: &Path) -> engineResult<deviceSession> {
    let provider = TcpProvider {
        addr: std::net::IpAddr::V4(std::net::Ipv4Addr::new(10, 7, 0, 1)),
        scope_id: None,
        pairing_file: pairing,
        label: "onDeviceLocation".into(),
    };
    let mut lockdown = bounded(
        8,
        LockdownClient::connect(&provider),
        "deviceUnreachable",
        "iPhone nicht erreichbar. Aktiviere LocalDevVPN und verbinde das iPhone mit WLAN.",
    )
    .await?;
    bounded(8, lockdown.start_session(&provider.pairing_file), "pairingRejected", "iOS hat die Pairing-Datei abgelehnt. Entsperre das Gerät oder exportiere die Datei erneut.").await?;
    let version = bounded(
        8,
        lockdown.get_value(Some("ProductVersion"), None),
        "deviceInformationFailed",
        "Die iOS-Version konnte nicht gelesen werden.",
    )
    .await?;
    let deviceVersion = version
        .as_string()
        .ok_or_else(|| {
            engineError::new("deviceInformationFailed", "Die iOS-Version ist ungültig.")
        })?
        .to_owned();
    if !supportedVersion(&deviceVersion) {
        return Err(engineError::new(
            "unsupportedVersion",
            "Diese Engine unterstützt iOS 17.4–18.x. Andere Versionen verwenden teilweise andere Protokolle.",
        ));
    }
    if let Some(expectedUdid) = &provider.pairing_file.udid {
        let deviceUdid = bounded(
            8,
            lockdown.get_value(Some("UniqueDeviceID"), None),
            "deviceInformationFailed",
            "Die Geräteidentität konnte nicht geprüft werden.",
        )
        .await?;
        if deviceUdid.as_string() != Some(expectedUdid.as_str()) {
            return Err(engineError::new(
                "deviceMismatch",
                "Die Pairing-Datei gehört zu einem anderen Gerät.",
            ));
        }
    }
    let mut heartbeat = bounded(
        8,
        HeartbeatClient::connect(&provider),
        "heartbeatFailed",
        "Der Heartbeat-Dienst ist nicht erreichbar. Prüfe VPN, WLAN und Pairing.",
    )
    .await?;
    let heartbeatAt = Arc::new(AtomicU64::new(timestamp()));
    let heartbeatClock = heartbeatAt.clone();
    let mut heartbeatTask = taskGuard(tokio::spawn(async move {
        let mut interval = 15;
        loop {
            interval = heartbeat.get_marco(interval + 10).await?.clamp(1, 60);
            heartbeat.send_polo().await?;
            heartbeatClock.store(timestamp(), Ordering::Relaxed);
        }
        #[allow(unreachable_code)]
        Ok::<(), idevice::IdeviceError>(())
    }));
    let mut mounter = bounded(
        8,
        ImageMounter::connect(&provider),
        "developerImageConnectionFailed",
        "Der Image-Mounter-Dienst ist nicht erreichbar.",
    )
    .await?;
    let developerMode = bounded(
        8,
        mounter.query_developer_mode_status(),
        "developerModeUnknown",
        "Der Entwicklermodus konnte nicht geprüft werden.",
    )
    .await?;
    if !developerMode {
        return Err(engineError::new(
            "developerModeDisabled",
            "Aktiviere Einstellungen → Datenschutz & Sicherheit → Entwicklermodus und starte das iPhone neu.",
        ));
    }
    match bounded(
        8,
        mounter.lookup_image("Personalized"),
        "developerImageMissing",
        "Das Developer Disk Image ist nicht gemountet.",
    )
    .await
    {
        Ok(_) => {}
        Err(error) if error.code == "developerImageMissing" => {
            let chipId = bounded(
                8,
                lockdown.get_value(Some("UniqueChipID"), None),
                "deviceInformationFailed",
                "Die Gerätekennung für das Developer Disk Image fehlt.",
            )
            .await?
            .as_unsigned_integer()
            .ok_or_else(|| {
                engineError::new("deviceInformationFailed", "Die Gerätekennung ist ungültig.")
            })?;
            timeout(
                Duration::from_secs(180),
                mountImage(&provider, &mut mounter, imageDirectory, chipId),
            )
            .await
            .map_err(|_| {
                engineError::new(
                    "developerImageTimeout",
                    "Das Vorbereiten des Developer Disk Images hat zu lange gedauert.",
                )
            })??;
        }
        Err(error) => return Err(error),
    }
    let proxy = bounded(
        10,
        CoreDeviceProxy::connect(&provider),
        "tunnelFailed",
        "Der CoreDevice-Tunnel konnte nicht geöffnet werden.",
    )
    .await?;
    let rsdPort = proxy.tunnel_info().server_rsd_port;
    let adapter = proxy.create_software_tunnel().map_err(|_| {
        engineError::new(
            "tunnelFailed",
            "Der lokale TCP/IP-Tunnel konnte nicht erzeugt werden.",
        )
    })?;
    let mut adapter = adapter.to_async_handle();
    let stream = timeout(Duration::from_secs(10), adapter.connect(rsdPort))
        .await
        .map_err(|_| engineError::new("rsdTimeout", "RSD antwortet nicht im Developer-Tunnel."))?
        .map_err(|_| engineError::new("rsdFailed", "Der RSD-Dienst ist nicht erreichbar."))?;
    let mut handshake = bounded(
        10,
        RsdHandshake::new(stream),
        "rsdFailed",
        "Der RSD-Handshake ist fehlgeschlagen.",
    )
    .await?;
    let mut remote = bounded(
        10,
        RemoteServerClient::connect_rsd(&mut adapter, &mut handshake),
        "dvtUnavailable",
        "Der Instruments-Dienst ist nicht verfügbar. Prüfe das Developer Disk Image.",
    )
    .await?;
    bounded(
        10,
        remote.read_message(0),
        "dvtHandshakeFailed",
        "Der Instruments-Handshake ist fehlgeschlagen.",
    )
    .await?;
    let (commands, mut receiver) = mpsc::channel::<sessionCommand>(1);
    let (readySender, readyReceiver) = oneshot::channel();
    let task = taskGuard(tokio::spawn(async move {
        let mut channel = match bounded(
            10,
            remote.make_channel("com.apple.instruments.server.services.LocationSimulation"),
            "locationChannelFailed",
            "Der DVT-Kanal zur Standortsimulation ist nicht verfügbar.",
        )
        .await
        {
            Ok(channel) => channel,
            Err(error) => {
                let _ = readySender.send(Err(error));
                return;
            }
        };
        if readySender.send(Ok(())).is_err() {
            return;
        }
        loop {
            tokio::select! {
                _ = &mut heartbeatTask.0 => break,
                _ = channel.read_message() => break,
                command = receiver.recv() => {
                    let Some(command) = command else { break; };
                    let result = sendLocation(&mut channel, command.target).await;
                    let shouldClose = result.is_err() || command.target.is_none();
                    let _ = command.response.send(result);
                    if shouldClose { break; }
                }
            }
        }
        drop(remote);
        drop(adapter);
    }));
    readyReceiver.await.map_err(|_| {
        engineError::new(
            "connectionClosed",
            "Der Developer-Tunnel wurde beim Start getrennt.",
        )
    })??;
    Ok(deviceSession {
        commands,
        task,
        heartbeatAt,
        deviceVersion,
    })
}

impl locationEngine {
    fn refreshState(&mut self) {
        if let Some(session) = &self.session {
            self.state.lastHeartbeatAt = Some(session.heartbeatAt.load(Ordering::Relaxed));
            if session.task.0.is_finished()
                || timestamp().saturating_sub(self.state.lastHeartbeatAt.unwrap_or(0)) > 90_000
            {
                self.session = None;
                self.state.phase = if self.state.requiresReset {
                    "unknown"
                } else {
                    "disconnected"
                }
                .into();
            }
        }
    }

    async fn prepare(&mut self, pairing: &[u8], directory: &Path) -> engineResult<()> {
        self.refreshState();
        if self.session.is_some() {
            return Ok(());
        }
        let session = timeout(Duration::from_secs(240), openSession(parsePairing(pairing)?, directory)).await
            .map_err(|_| engineError::new("preparationTimeout", "Die Vorbereitung wurde nach vier Minuten abgebrochen. Prüfe das Developer Disk Image und die Verbindung."))??;
        self.state.deviceVersion = Some(session.deviceVersion.clone());
        self.state.phase = if self.state.requiresReset {
            "unknown"
        } else {
            "ready"
        }
        .into();
        self.session = Some(session);
        Ok(())
    }

    async fn execute(&mut self, request: engineRequest, pairing: &[u8]) -> engineResult<Value> {
        self.refreshState();
        match request.operation.as_str() {
            "validatePairing" => {
                parsePairing(pairing)?;
                return Ok(json!({ "valid": true }));
            }
            "getState" => return Ok(json!(self.state)),
            "disconnect" => {
                self.session = None;
                self.state.phase = if self.state.requiresReset {
                    "unknown"
                } else {
                    "disconnected"
                }
                .into();
                return Ok(json!(self.state));
            }
            "prepare" | "set" | "reset" => {}
            _ => {
                return Err(engineError::new(
                    "invalidOperation",
                    "Unbekannte Engine-Operation.",
                ));
            }
        }
        let target = if request.operation == "set" {
            Some(
                coordinates {
                    latitude: request.latitude.ok_or_else(|| {
                        engineError::new("invalidCoordinates", "Breitengrad fehlt.")
                    })?,
                    longitude: request.longitude.ok_or_else(|| {
                        engineError::new("invalidCoordinates", "Längengrad fehlt.")
                    })?,
                }
                .validate()?,
            )
        } else {
            None
        };
        let directory = request.imageDirectory.as_deref().ok_or_else(|| {
            engineError::new(
                "imageDirectoryMissing",
                "Das lokale Developer-Image-Verzeichnis fehlt.",
            )
        })?;
        self.prepare(pairing, Path::new(directory)).await?;
        if request.operation == "prepare" {
            return Ok(json!(self.state));
        }
        let (response, result) = oneshot::channel();
        let session = self.session.as_ref().ok_or_else(|| {
            engineError::new("connectionClosed", "Keine aktive Developer-Verbindung.")
        })?;
        self.state.requiresReset = true;
        self.state.phase = "unknown".into();
        let outcome = async {
            session.commands.send(sessionCommand { target, response }).await
                .map_err(|_| engineError::new("connectionClosed", "Die Developer-Verbindung wurde getrennt."))?;
            timeout(Duration::from_secs(25), result).await
                .map_err(|_| engineError::new("commandTimeout", "Keine Bestätigung für den Standortbefehl. Der Systemzustand ist unbekannt."))?
                .map_err(|_| engineError::new("connectionClosed", "Die Developer-Verbindung wurde getrennt."))?
        }.await;
        if let Err(error) = outcome {
            self.session = None;
            return Err(error);
        }
        self.state.lastCoordinates = target;
        self.state.lastConfirmedAt = Some(timestamp());
        self.state.requiresReset = target.is_some();
        self.state.phase = if target.is_some() {
            "active"
        } else {
            "disconnected"
        }
        .into();
        if target.is_none() {
            self.session = None;
        }
        Ok(match target {
            Some(target) => {
                json!({ "status": "applied", "scope": "system", "latitude": target.latitude, "longitude": target.longitude, "state": self.state })
            }
            None => json!({ "status": "cleared", "scope": "system", "state": self.state }),
        })
    }
}

fn executeRequest(request: &str, pairing: &[u8]) -> Value {
    let request: engineRequest = match serde_json::from_str(request) {
        Ok(request) => request,
        Err(_) => {
            return json!({ "ok": false, "error": engineError::new("invalidRequest", "Ungültige Engine-Anfrage.") });
        }
    };
    let runtime = engineRuntime.get_or_init(|| {
        tokio::runtime::Builder::new_multi_thread()
            .worker_threads(2)
            .enable_all()
            .build()
            .map_err(|_| "runtimeUnavailable".to_owned())
    });
    let Ok(runtime) = runtime else {
        return json!({ "ok": false, "error": engineError::new("runtimeUnavailable", "Die native Laufzeit konnte nicht gestartet werden.") });
    };
    let Ok(mut engine) = sharedEngine
        .get_or_init(|| Mutex::new(locationEngine::default()))
        .try_lock()
    else {
        return json!({ "ok": false, "error": engineError::new("engineBusy", "Eine Engine-Operation läuft bereits.") });
    };
    match runtime.block_on(engine.execute(request, pairing)) {
        Ok(data) => json!({ "ok": true, "data": data }),
        Err(error) => json!({ "ok": false, "error": error, "state": engine.state }),
    }
}

#[unsafe(no_mangle)]
pub unsafe extern "C" fn locationEngineExecute(
    request: *const c_char,
    pairing: *const u8,
    pairingLength: usize,
) -> *mut c_char {
    let result = std::panic::catch_unwind(|| {
        if request.is_null() || pairingLength > 2 * 1024 * 1024 || (pairingLength > 0 && pairing.is_null()) {
            return json!({ "ok": false, "error": engineError::new("invalidInput", "Ungültige native Eingabe.") });
        }
        let request = unsafe { CStr::from_ptr(request) }.to_str();
        let pairing = if pairingLength == 0 { &[] } else { unsafe { std::slice::from_raw_parts(pairing, pairingLength) } };
        match request {
            Ok(request) if request.len() <= 16 * 1024 => executeRequest(request, pairing),
            _ => json!({ "ok": false, "error": engineError::new("invalidInput", "Ungültige native Eingabe.") }),
        }
    }).unwrap_or_else(|_| json!({ "ok": false, "error": engineError::new("engineFailure", "Die native Engine wurde unerwartet unterbrochen. Starte die App neu und setze den Standort zurück.") }));
    CString::new(result.to_string())
        .unwrap_or_default()
        .into_raw()
}

#[unsafe(no_mangle)]
pub unsafe extern "C" fn locationEngineFree(result: *mut c_char) {
    if !result.is_null() {
        drop(unsafe { CString::from_raw(result) });
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use idevice::dvt::message::{MessageHeader, PayloadHeader};
    use tokio::io::{AsyncWriteExt, DuplexStream};

    async fn replyToRequest(stream: &mut DuplexStream, request: &Message, failure: bool) {
        let header = request.message_header.serialize();
        let identifier = u32::from_le_bytes(header[16..20].try_into().unwrap());
        let reply = Message::new(
            MessageHeader::new(0, 1, identifier, 1, -request.message_header.channel, false),
            PayloadHeader::new(),
            None,
            if failure {
                Some("NSError".into())
            } else {
                None
            },
        );
        for chunk in reply.serialize().chunks(3) {
            stream.write_all(chunk).await.unwrap();
            tokio::task::yield_now().await;
        }
    }

    #[tokio::test]
    async fn realDvtEncodingSendsCoordinatesAndClearOverAFragmentedTransport() {
        let (client, mut peer) = tokio::io::duplex(65536);
        let server = tokio::spawn(async move {
            let channelRequest = Message::from_reader(&mut peer).await.unwrap();
            assert_eq!(
                channelRequest.data,
                Some("_requestChannelWithCode:identifier:".into())
            );
            replyToRequest(&mut peer, &channelRequest, false).await;
            let setRequest = Message::from_reader(&mut peer).await.unwrap();
            assert_eq!(
                setRequest.data,
                Some("simulateLocationWithLatitude:longitude:".into())
            );
            assert_eq!(
                setRequest.aux.as_ref().unwrap().values,
                vec![
                    AuxValue::archived_value(52.516275),
                    AuxValue::archived_value(13.377704)
                ]
            );
            replyToRequest(&mut peer, &setRequest, false).await;
            let resetRequest = Message::from_reader(&mut peer).await.unwrap();
            assert_eq!(resetRequest.data, Some("stopLocationSimulation".into()));
            assert!(resetRequest.aux.is_none());
            replyToRequest(&mut peer, &resetRequest, false).await;
        });
        timeout(Duration::from_secs(3), async {
            let mut remote = RemoteServerClient::new(client);
            let mut channel = remote
                .make_channel("com.apple.instruments.server.services.LocationSimulation")
                .await
                .unwrap();
            sendLocation(
                &mut channel,
                Some(coordinates {
                    latitude: 52.516275,
                    longitude: 13.377704,
                }),
            )
            .await
            .unwrap();
            sendLocation(&mut channel, None).await.unwrap();
            server.await.unwrap();
        })
        .await
        .unwrap();
    }

    #[tokio::test]
    async fn dvtErrorResponseCannotBecomeAnAppliedResult() {
        let (client, mut peer) = tokio::io::duplex(65536);
        let server = tokio::spawn(async move {
            let channelRequest = Message::from_reader(&mut peer).await.unwrap();
            replyToRequest(&mut peer, &channelRequest, false).await;
            let setRequest = Message::from_reader(&mut peer).await.unwrap();
            replyToRequest(&mut peer, &setRequest, true).await;
        });
        timeout(Duration::from_secs(3), async {
            let mut remote = RemoteServerClient::new(client);
            let mut channel = remote
                .make_channel("com.apple.instruments.server.services.LocationSimulation")
                .await
                .unwrap();
            let error = sendLocation(
                &mut channel,
                Some(coordinates {
                    latitude: 1.0,
                    longitude: 2.0,
                }),
            )
            .await
            .unwrap_err();
            assert_eq!(error.code, "dvtRejected");
            server.await.unwrap();
        })
        .await
        .unwrap();
    }

    #[tokio::test]
    async fn imagePlistFramingSurvivesPartialReads() {
        let (client, mut peer) = tokio::io::duplex(1024);
        let server = tokio::spawn(async move {
            let length = peer.read_u32().await.unwrap() as usize;
            let mut data = vec![0; length];
            peer.read_exact(&mut data).await.unwrap();
            let request: plist::Value = plist::from_bytes(&data).unwrap();
            assert_eq!(request.as_string(), Some("ReceiveBytes"));
            let mut response = Vec::new();
            plist::to_writer_xml(&mut response, &plist::Value::String("Complete".into())).unwrap();
            peer.write_u32(response.len() as u32).await.unwrap();
            for chunk in response.chunks(5) {
                peer.write_all(chunk).await.unwrap();
            }
        });
        let mut connection = idevice::Idevice::new(Box::new(client), "test");
        writePlist(
            &mut connection,
            &plist::Value::String("ReceiveBytes".into()),
        )
        .await
        .unwrap();
        assert_eq!(
            readPlist(&mut connection).await.unwrap().as_string(),
            Some("Complete")
        );
        server.await.unwrap();
    }

    #[tokio::test]
    async fn imagePlistRejectsUnboundedReplyAllocation() {
        let (client, mut peer) = tokio::io::duplex(16);
        peer.write_u32(u32::MAX).await.unwrap();
        let mut connection = idevice::Idevice::new(Box::new(client), "test");
        assert_eq!(
            readPlist(&mut connection).await.unwrap_err().code,
            "imageProtocolFailed"
        );
    }

    fn testRequest(operation: &str) -> engineRequest {
        engineRequest {
            operation: operation.into(),
            latitude: Some(1.0),
            longitude: Some(2.0),
            imageDirectory: Some("unused".into()),
        }
    }

    #[tokio::test]
    async fn engineTracksConfirmedSetAndResetWithoutPretendingToHaveSatelliteFix() {
        let (commands, mut receiver) = mpsc::channel::<sessionCommand>(1);
        let task = taskGuard(tokio::spawn(async move {
            while let Some(command) = receiver.recv().await {
                let _ = command.response.send(Ok(()));
            }
        }));
        let mut engine = locationEngine {
            session: Some(deviceSession {
                commands,
                task,
                heartbeatAt: Arc::new(AtomicU64::new(timestamp())),
                deviceVersion: "18.6".into(),
            }),
            state: engineState::default(),
        };
        let setResult = engine.execute(testRequest("set"), &[]).await.unwrap();
        assert_eq!(setResult["status"], "applied");
        assert_eq!(engine.state.phase, "active");
        assert!(engine.state.requiresReset);
        let resetResult = engine.execute(testRequest("reset"), &[]).await.unwrap();
        assert_eq!(resetResult["status"], "cleared");
        assert!(!engine.state.requiresReset);
        assert!(engine.state.lastCoordinates.is_none());
        assert!(engine.session.is_none());
    }

    #[tokio::test]
    async fn tunnelFailureRetainsUncertaintyAndClosesSession() {
        let (commands, mut receiver) = mpsc::channel::<sessionCommand>(1);
        let task = taskGuard(tokio::spawn(async move {
            while let Some(command) = receiver.recv().await {
                let _ = command
                    .response
                    .send(Err(engineError::new("dvtReadFailed", "Disconnected")));
            }
        }));
        let mut engine = locationEngine {
            session: Some(deviceSession {
                commands,
                task,
                heartbeatAt: Arc::new(AtomicU64::new(timestamp())),
                deviceVersion: "18.6".into(),
            }),
            state: engineState::default(),
        };
        assert!(engine.execute(testRequest("set"), &[]).await.is_err());
        assert_eq!(engine.state.phase, "unknown");
        assert!(engine.state.requiresReset);
        assert!(engine.session.is_none());
    }

    #[test]
    fn coordinatesRejectInvalidValues() {
        for target in [
            coordinates {
                latitude: f64::NAN,
                longitude: 0.0,
            },
            coordinates {
                latitude: 0.0,
                longitude: f64::INFINITY,
            },
            coordinates {
                latitude: 91.0,
                longitude: 0.0,
            },
        ] {
            assert!(target.validate().is_err());
        }
        assert!(
            coordinates {
                latitude: -90.0,
                longitude: 180.0
            }
            .validate()
            .is_ok()
        );
    }

    #[test]
    fn versionGateDoesNotClaimUnimplementedProtocols() {
        for version in ["17.4", "17.7.2", "18.0", "18.7.1"] {
            assert!(supportedVersion(version));
        }
        for version in ["17.3.1", "16.7", "26.0", "invalid", "18"] {
            assert!(!supportedVersion(version));
        }
    }

    #[test]
    fn invalidPairingNeverReachesTheNetwork() {
        assert_eq!(parsePairing(&[]).unwrap_err().code, "pairingMissing");
        assert_eq!(parsePairing(b"invalid").unwrap_err().code, "pairingInvalid");
    }

    #[test]
    fn onlyEmptyDvtRepliesConfirmAnOperation() {
        let header = MessageHeader::new(0, 1, 4, 1, 1, false);
        let reply = Message::new(header, PayloadHeader::new(), None, None);
        assert!(validateReply(&reply).is_ok());
        let failure = Message::new(header, PayloadHeader::new(), None, Some("NSError".into()));
        assert!(validateReply(&failure).is_err());
        let unsolicited = Message::new(
            MessageHeader::new(0, 1, 4, 0, 1, false),
            PayloadHeader::new(),
            None,
            None,
        );
        assert!(validateReply(&unsolicited).is_err());
    }

    #[test]
    fn imageUploadRequiresAnExplicitAcknowledgement() {
        let response = plist::Value::Dictionary(
            [(
                "Status".to_owned(),
                plist::Value::String("Complete".to_owned()),
            )]
            .into_iter()
            .collect(),
        );
        assert!(checkUploadStatus(&response, "Complete").is_ok());
        assert!(checkUploadStatus(&response, "ReceiveBytesAck").is_err());
    }

    #[test]
    fn malformedRequestsAndNullPointersReturnErrors() {
        assert_eq!(executeRequest("notJson", &[])["ok"], false);
        let output = unsafe { locationEngineExecute(std::ptr::null(), std::ptr::null(), 0) };
        let result: Value =
            serde_json::from_str(unsafe { CStr::from_ptr(output) }.to_str().unwrap()).unwrap();
        unsafe {
            locationEngineFree(output);
        }
        assert_eq!(result["error"]["code"], "invalidInput");
    }
}
