import { Server as IOServer, Socket } from "socket.io";
import { Server as HTTPServer } from "http";
import { createServer } from "http";

// Define server state type
interface ServerState {
  socketServer?: IOServer;
  httpServer?: HTTPServer;
  vitalsInterval?: NodeJS.Timeout;
  isShuttingDown?: boolean;
}

// Global state with type safety
declare global {
  var serverState: ServerState;
}

// Initialize global state if it doesn't exist
if (!global.serverState) {
  global.serverState = {
    socketServer: undefined,
    httpServer: undefined,
    vitalsInterval: undefined,
    isShuttingDown: false,
  };
}

interface Vitals {
  timestamp: string;
  heart_rate: number;
  spo2: number;
}

function generateVitals(): Vitals {
  return {
    timestamp: new Date().toISOString(),
    heart_rate: Math.floor(Math.random() * (100 - 60 + 1)) + 60, // 60-100 bpm
    spo2: Math.floor(Math.random() * (100 - 90 + 1)) + 90, // 90-100%
  };
}

function startVitalsEmission(io: IOServer) {
  if (!global.serverState.vitalsInterval) {
    global.serverState.vitalsInterval = setInterval(() => {
      const vitals = generateVitals();
      io.emit("vitals", vitals);
      console.log("Emitted vitals:", vitals);
    }, 2000);
  }
}

export function initSocketServer(): IOServer | undefined {
  try {
    if (!global.serverState.socketServer) {
      console.log("🔌 Initializing Socket.IO server...");

      // Create HTTP server if it doesn't exist
      if (!global.serverState.httpServer) {
        const httpServer = createServer();
        const port = parseInt(process.env.SOCKET_PORT || "3001");
        httpServer.listen(port, () => {
          console.log(`HTTP Server is running on port ${port}`);
        });
        global.serverState.httpServer = httpServer;
      }

      // Create Socket.IO server
      const io = new IOServer(global.serverState.httpServer, {
        cors: {
          origin: "*",
          methods: ["GET", "POST"],
          credentials: true,
        },
        path: "/api/socket_io",
        addTrailingSlash: false,
        transports: ["websocket", "polling"],
        pingTimeout: 60000,
        pingInterval: 25000,
      });

      // Set up connection handling
      io.on("connection", (socket: Socket) => {
        console.log("Client connected:", socket.id);

        // Start vitals emission when first client connects
        startVitalsEmission(io);

        // Handle disconnection
        socket.on("disconnect", (reason) => {
          console.log(`Client disconnected (${socket.id}):`, reason);

          // If no clients are connected, clear the vitals interval
          if (io.engine.clientsCount === 0 && global.vitalsInterval) {
            clearInterval(global.vitalsInterval);
            global.vitalsInterval = undefined;
            console.log("Stopped vitals emission - no clients connected");
          }
        });

        // Handle errors
        socket.on("error", (error) => {
          console.error(`Socket error (${socket.id}):`, error);
        });
      });

      global.serverState.socketServer = io;
      console.log("Socket.IO server initialized successfully");
    }

    return global.serverState.socketServer;
  } catch (error) {
    console.error("Failed to initialize Socket.IO server:", error);
    cleanup();
    return undefined;
  }
}

export function getSocketServer(): IOServer | undefined {
  return global.serverState.socketServer;
}

export async function cleanup(): Promise<void> {
  global.serverState.isShuttingDown = true;

  try {
    if (global.serverState.vitalsInterval) {
      clearInterval(global.serverState.vitalsInterval);
      global.serverState.vitalsInterval = undefined;
    }

    // Close all socket connections
    if (global.serverState.socketServer) {
      const socketServer = global.serverState.socketServer;

      // Disconnect all clients
      socketServer.sockets.sockets.forEach((socket) => {
        socket.disconnect(true);
      });

      // Close socket server
      await new Promise<void>((resolve) => {
        socketServer.close(() => {
          console.log("Socket.IO server closed");
          resolve();
        });
      });

      global.serverState.socketServer = undefined;
    }

    // Close HTTP server
    if (global.serverState.httpServer) {
      const httpServer = global.serverState.httpServer;

      await new Promise<void>((resolve) => {
        httpServer.close(() => {
          console.log("HTTP server closed");
          resolve();
        });
      });

      global.serverState.httpServer = undefined;
    }
  } catch (error) {
    console.error("Error during cleanup:", error);
  } finally {
    global.serverState.isShuttingDown = false;
  }
}
