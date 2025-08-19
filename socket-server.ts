import { Server as IOServer } from "socket.io";
import { createServer } from "http";

let io: IOServer | null = null;

export function initSocketServer() {
  if (!io) {
    console.log("🔌 Initializing Socket.IO server...");

    // Create HTTP server
    const httpServer = createServer();

    // Create Socket.IO server
    io = new IOServer(httpServer, {
      cors: {
        origin: "*",
        methods: ["GET", "POST"],
      },
      path: "/api/socket_io",
      addTrailingSlash: false,
    });

    // Start listening on a port
    const port = parseInt(process.env.SOCKET_PORT || "3001");
    httpServer.listen(port, () => {
      console.log(`Socket.IO server listening on port ${port}`);
    });

    // Set up connection handling
    io.on("connection", (socket) => {
      console.log("Client connected:", socket.id);

      socket.on("disconnect", () => {
        console.log("Client disconnected:", socket.id);
      });
    });
  }

  return io;
}
