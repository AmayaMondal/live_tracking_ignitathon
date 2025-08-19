import { Server as IOServer } from "socket.io";
import { createServer } from "http";

export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";

// Declare global variables for persistence across requests
declare global {
  var io: IOServer | undefined;
  var httpServer: any;
  var vitalsInterval: NodeJS.Timeout | undefined;
}

// Initialize global variables if they don't exist
if (!global.io) {
  global.io = undefined;
}

if (!global.vitalsInterval) {
  global.vitalsInterval = undefined;
}

export async function GET(req: Request) {
  try {
    if (!global.io) {
      console.log("🔌 Starting Socket.IO server...");

      // Create HTTP server if it doesn't exist
      if (!global.httpServer) {
        global.httpServer = createServer();
        const port = parseInt(process.env.SOCKET_PORT || "3001");
        global.httpServer.listen(port, () => {
          console.log(`HTTP Server is running on port ${port}`);
        });
      }

      // Create Socket.IO server
      global.io = new IOServer(global.httpServer, {
        cors: {
          origin: ["http://localhost:3000", "http://localhost:3001"],
          methods: ["GET", "POST"],
          credentials: true,
          allowedHeaders: ["Content-Type"],
        },
        path: "/api/socket_io",
        addTrailingSlash: false,
        transports: ["websocket", "polling"],
        pingTimeout: 60000,
        pingInterval: 25000,
      });

      // Set up connection handling
      global.io.on("connection", (socket) => {
        console.log("Client connected:", socket.id);

        socket.on("disconnect", () => {
          console.log("Client disconnected:", socket.id);
        });
      });

      // Start emitting vitals if not already started
      if (!global.vitalsInterval) {
        global.vitalsInterval = setInterval(() => {
          const vitals = {
            timestamp: new Date().toISOString(),
            heart_rate: Math.floor(Math.random() * (100 - 60 + 1)) + 60, // 60-100 bpm
            spo2: Math.floor(Math.random() * (100 - 90 + 1)) + 90, // 90-100%
          };
          global.io?.emit("vitals", vitals);
          console.log("Emitted vitals:", vitals);
        }, 2000);
      }

      return new Response("Socket.IO server is running", {
        status: 200,
        headers: {
          "Content-Type": "text/plain",
          "Cache-Control": "no-cache, no-transform",
          Connection: "keep-alive",
        },
      });
    }

    return new Response("Socket.IO server already running", {
      status: 200,
      headers: {
        "Content-Type": "text/plain",
        "Cache-Control": "no-cache, no-transform",
      },
    });
  } catch (error) {
    console.error("Socket.IO server error:", error);
    return new Response("Internal Server Error", { status: 500 });
  }
}
