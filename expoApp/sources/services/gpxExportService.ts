import { GeographicCoordinates, WaypointRecord } from "../models/locationTypes";

export class GpxExportService {
  private static instance: GpxExportService;

  private constructor() {}

  public static getInstance(): GpxExportService {
    if (!GpxExportService.instance) {
      GpxExportService.instance = new GpxExportService();
    }
    return GpxExportService.instance;
  }

  public generateSingleWaypointGpx(
    coordinates: GeographicCoordinates,
    locationName: string = "Simulierter Standort"
  ): string {
    const timestampIso = new Date().toISOString();
    const sanitizedName = this.escapeXml(locationName);

    return `<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1" creator="LocationChanger" xmlns="http://www.topografix.com/GPX/1/1">
  <wpt lat="${coordinates.latitude.toFixed(6)}" lon="${coordinates.longitude.toFixed(6)}">
    <name>${sanitizedName}</name>
    <time>${timestampIso}</time>
  </wpt>
</gpx>`;
  }

  public generateTrackRouteGpx(
    waypoints: WaypointRecord[],
    routeName: string = "Simulierte Route"
  ): string {
    const sanitizedName = this.escapeXml(routeName);
    const trackPointsXml = waypoints
      .map(
        (point) => `      <trkpt lat="${point.latitude.toFixed(6)}" lon="${point.longitude.toFixed(6)}">
        <ele>${point.elevationMeters.toFixed(1)}</ele>
        <time>${point.timestampIso}</time>
      </trkpt>`
      )
      .join("\n");

    return `<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1" creator="LocationChanger" xmlns="http://www.topografix.com/GPX/1/1">
  <trk>
    <name>${sanitizedName}</name>
    <trkseg>
${trackPointsXml}
    </trkseg>
  </trk>
</gpx>`;
  }

  private escapeXml(unsafeString: string): string {
    return unsafeString
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&apos;");
  }
}
