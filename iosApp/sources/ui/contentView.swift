import SwiftUI

struct ContentView: View {
    @State private var interactionCounter: Int = 0
    @State private var deviceDetails: DeviceDetails = DeviceInformationService.shared.fetchDeviceDetails()
    @State private var isSideloadConfirmed: Bool = false

    var body: some View {
        NavigationView {
            ScrollView {
                VStack(spacing: 20) {
                    headerSection
                    statusCardSection
                    deviceInfoSection
                    interactionSection
                }
                .padding()
            }
            .navigationTitle("Sideload Test")
            .background(Color(.systemGroupedBackground))
        }
    }

    private var headerSection: some View {
        VStack(spacing: 8) {
            Image(systemName: "checkmark.seal.fill")
                .resizable()
                .scaledToFit()
                .frame(width: 64, height: 64)
                .foregroundColor(.green)
            Text("Sideloadly Erfolgreich")
                .font(.title2)
                .fontWeight(.bold)
            Text("Die App wurde erfolgreich kompiliert, signiert und auf diesem iPhone installiert.")
                .font(.subheadline)
                .foregroundColor(.secondary)
                .multilineTextAlignment(.center)
        }
        .padding(.vertical)
    }

    private var statusCardSection: some View {
        VStack(alignment: .leading, spacing: 12) {
            Text("Test-Status")
                .font(.headline)
            HStack {
                Circle()
                    .fill(Color.green)
                    .frame(width: 12, height: 12)
                Text("Native Ausführung aktiv")
                    .font(.body)
                Spacer()
                Text("OK")
                    .font(.caption)
                    .fontWeight(.bold)
                    .padding(.horizontal, 8)
                    .padding(.vertical, 4)
                    .background(Color.green.opacity(0.2))
                    .foregroundColor(.green)
                    .cornerRadius(6)
            }
        }
        .padding()
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(Color(.secondarySystemGroupedBackground))
        .cornerRadius(12)
    }

    private var deviceInfoSection: some View {
        VStack(alignment: .leading, spacing: 12) {
            Text("Geräteinformationen")
                .font(.headline)
            infoRow(title: "System", value: "\(deviceDetails.systemName) \(deviceDetails.systemVersion)")
            Divider()
            infoRow(title: "Modell", value: deviceDetails.modelName)
            Divider()
            infoRow(title: "Batterieladung", value: deviceDetails.batteryLevelFormatted)
            Divider()
            infoRow(title: "Bildschirmgröße", value: deviceDetails.screenBoundsDescription)
        }
        .padding()
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(Color(.secondarySystemGroupedBackground))
        .cornerRadius(12)
    }

    private var interactionSection: some View {
        VStack(spacing: 16) {
            Text("Interaktionsprüfung")
                .font(.headline)
                .frame(maxWidth: .infinity, alignment: .leading)
            Text("Klicks: \(interactionCounter)")
                .font(.title3)
                .fontWeight(.semibold)
            HStack(spacing: 16) {
                Button(action: {
                    interactionCounter += 1
                }) {
                    Label("Zähler erhöhen", systemImage: "plus.circle.fill")
                        .font(.body.weight(.medium))
                        .frame(maxWidth: .infinity)
                        .padding()
                        .background(Color.blue)
                        .foregroundColor(.white)
                        .cornerRadius(10)
                }
                Button(action: {
                    interactionCounter = 0
                }) {
                    Label("Zurücksetzen", systemImage: "arrow.counterclockwise")
                        .font(.body.weight(.medium))
                        .padding()
                        .background(Color(.tertiarySystemFill))
                        .foregroundColor(.primary)
                        .cornerRadius(10)
                }
            }
            Toggle("Sideload-Bestätigung", isOn: $isSideloadConfirmed)
                .padding(.top, 8)
        }
        .padding()
        .frame(maxWidth: .infinity)
        .background(Color(.secondarySystemGroupedBackground))
        .cornerRadius(12)
    }

    private func infoRow(title: String, value: String) -> some View {
        HStack {
            Text(title)
                .foregroundColor(.secondary)
            Spacer()
            Text(value)
                .fontWeight(.medium)
        }
    }
}
