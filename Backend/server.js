import express from "express";
import cors from "cors";
import { createServer } from "http";
import { Server } from "socket.io";
import { YSocketIO } from "y-socket.io/dist/server";
import vm from "node:vm";

const app = express();
app.use(cors());
app.use(express.json({ limit: "1mb" }));
app.use(express.static("public"));

const httpServer = createServer(app);

const io = new Server(httpServer, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"],
  },
});

const ySocketIO = new YSocketIO(io);
ySocketIO.initialize();

app.get("/health", (req, res) => {
  res.status(200).json({
    message: "ok",
    success: true,
  });
});

app.post("/api/execute", async (req, res) => {
  const { code, language } = req.body || {};

  if (!code || typeof code !== "string") {
    return res.status(400).json({
      error: "Code is required.",
    });
  }

  if (language !== "javascript") {
    return res.status(400).json({
      error:
        "Execution is currently enabled only for JavaScript in this demo. For multi-language execution, integrate Judge0 or containerized runners.",
    });
  }

  try {
    let output = "";
    const logs = [];

    const sandbox = {
      console: {
        log: (...args) => {
          logs.push(args.map((arg) => String(arg)).join(" "));
        },
        error: (...args) => {
          logs.push(args.map((arg) => String(arg)).join(" "));
        },
      },
      setTimeout,
      setInterval,
      clearTimeout,
      clearInterval,
    };

    vm.createContext(sandbox);

    const script = new vm.Script(code);
    script.runInContext(sandbox, { timeout: 1500 });

    output = logs.join("\n");

    return res.status(200).json({
      output: output || "Code executed successfully. No output.",
    });
  } catch (err) {
    return res.status(400).json({
      error: err.message || "Execution failed.",
    });
  }
});

httpServer.listen(3000, () => {
  console.log("Server is running on port 3000");
});