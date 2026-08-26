import express, { Request, Response } from "express";
import cors from "cors";
import { Pool } from "pg";
import { spawn, ChildProcess } from "child_process";

const app = express();
const port = process.env.PORT || 8082;

app.use(cors());
app.use(express.json());

const databaseUrl =
  process.env.DATABASE_URL ||
  "postgresql://usr_locationdb:5fd7ae7efee19f0c6240756c3cf79e92A1!@app.veltic.kstaq.de:5432/locationdb";

const pool = new Pool({
  connectionString: databaseUrl,
  ssl: { rejectUnauthorized: false }
});

let activeSimulationProcess: ChildProcess | null = null;

const terminateSimulationProcess = (): void => {
  if (activeSimulationProcess) {
    try {
      activeSimulationProcess.kill();
    } catch {}
    activeSimulationProcess = null;
  }
};

app.get("/health", (req: Request, res: Response) => {
  res.json({
    status: "healthy",
    service: "veltic-location-backend",
    database: "connected",
    timestamp: Date.now()
  });
});

app.get("/api/favorites", async (req: Request, res: Response) => {
  try {
    const result = await pool.query(
      "SELECT id, title, address, latitude, longitude, created_at FROM favorites ORDER BY id ASC;"
    );
    res.json(result.rows);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.post("/api/favorites", async (req: Request, res: Response) => {
  const { title, address, latitude, longitude } = req.body;
  if (!title || latitude === undefined || longitude === undefined) {
    res.status(400).json({ error: "Missing required fields" });
    return;
  }

  try {
    const result = await pool.query(
      "INSERT INTO favorites (title, address, latitude, longitude) VALUES ($1, $2, $3, $4) RETURNING *;",
      [title, address || "", latitude, longitude]
    );
    res.status(201).json(result.rows[0]);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.delete("/api/favorites/:id", async (req: Request, res: Response) => {
  const paramId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const favoriteId = parseInt(paramId, 10);
  try {
    await pool.query("DELETE FROM favorites WHERE id = $1;", [favoriteId]);
    res.json({ success: true, deletedId: favoriteId });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.get("/api/locations/active", async (req: Request, res: Response) => {
  try {
    const result = await pool.query(
      "SELECT id, device_name, is_active, latitude, longitude, place_name, updated_at FROM active_simulations ORDER BY updated_at DESC LIMIT 1;"
    );
    if (result.rows.length === 0) {
      res.json({ isActive: false, coordinates: null });
      return;
    }
    const simulation = result.rows[0];
    res.json({
      isActive: simulation.is_active,
      placeName: simulation.place_name,
      coordinates: simulation.is_active
        ? { latitude: simulation.latitude, longitude: simulation.longitude }
        : null,
      updatedAt: simulation.updated_at
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.post("/set-location", async (req: Request, res: Response) => {
  const { latitude, longitude, placeName, deviceName } = req.body;
  if (latitude === undefined || longitude === undefined) {
    res.status(400).json({ error: "Latitude and Longitude are required" });
    return;
  }

  terminateSimulationProcess();

  const targetDevice = deviceName || "iPhone";
  const targetPlace = placeName || "Simulierter Standort";

  try {
    await pool.query(
      "INSERT INTO active_simulations (device_name, is_active, latitude, longitude, place_name, updated_at) VALUES ($1, true, $2, $3, $4, CURRENT_TIMESTAMP);",
      [targetDevice, latitude, longitude, targetPlace]
    );
  } catch {}

  activeSimulationProcess = spawn(
    "python",
    [
      "-m",
      "pymobiledevice3",
      "developer",
      "dvt",
      "simulate-location",
      "set",
      "--userspace",
      String(latitude),
      String(longitude)
    ],
    { stdio: "ignore" }
  );

  res.json({
    status: "success",
    isActive: true,
    latitude,
    longitude,
    placeName: targetPlace
  });
});

app.post("/reset-location", async (req: Request, res: Response) => {
  terminateSimulationProcess();

  try {
    await pool.query(
      "INSERT INTO active_simulations (device_name, is_active, latitude, longitude, place_name, updated_at) VALUES ($1, false, NULL, NULL, 'Reales GPS', CURRENT_TIMESTAMP);",
      ["iPhone"]
    );
  } catch {}

  spawn(
    "python",
    [
      "-m",
      "pymobiledevice3",
      "developer",
      "dvt",
      "simulate-location",
      "clear",
      "--userspace"
    ],
    { stdio: "ignore" }
  );

  res.json({
    status: "reset",
    isActive: false
  });
});

app.listen(port, () => {
  console.log(`Veltic Location TypeScript Backend listening on port ${port}`);
});
