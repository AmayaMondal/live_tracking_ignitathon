"use client";

import { useEffect, useState } from "react";
import { io, Socket } from "socket.io-client";

interface Vitals {
  timestamp: string;
  heart_rate: number;
  spo2: number;
}

let socket: Socket | null = null;

export default function VitalsListener() {
  const [vitals, setVitals] = useState<Vitals | null>(null);
  const [isConnecting, setIsConnecting] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const initSocket = async () => {
      try {
        setIsConnecting(true);
        setError(null);

        // Ensure API route is hit to start server
        const response = await fetch("/api/socket");
        if (!response.ok) {
          throw new Error(`Failed to start socket server: ${response.status}`);
        }

        // Connect to Socket.IO
        if (!socket) {
          const socketUrl =
            process.env.NEXT_PUBLIC_SOCKET_URL || "http://localhost:3001";
          console.log("Connecting to socket server at:", socketUrl);

          socket = io(socketUrl, {
            path: "/api/socket_io",
            transports: ["websocket", "polling"],
            reconnectionDelayMax: 10000,
            reconnectionAttempts: 5,
            withCredentials: true,
            autoConnect: true,
            timeout: 60000,
            forceNew: true,
          });

          socket.on("connect", () => {
            console.log("Socket connected successfully:", socket?.id);
            setIsConnecting(false);
          });

          socket.on("disconnect", (reason) => {
            console.log("Socket disconnected:", reason);
            setIsConnecting(true);
          });

          socket.on("connect_error", (error) => {
            console.error("Socket connection error:", error);
            setError(error.message);
            setIsConnecting(false);

            // Try to reconnect after a delay
            setTimeout(() => {
              console.log("Attempting to reconnect...");
              socket?.connect();
            }, 5000);
          });

          socket.on("error", (error) => {
            console.error("Socket error:", error);
            setError("Socket error occurred");
          });

          socket.on("reconnect", (attemptNumber) => {
            console.log("Socket reconnected after", attemptNumber, "attempts");
            setIsConnecting(false);
            setError(null);
          });

          socket.on("reconnect_error", (error) => {
            console.error("Socket reconnection error:", error);
            setError("Failed to reconnect");
          });

          socket.on("vitals", (data: Vitals) => {
            console.log("Received vitals:", data);
            setVitals(data);
            setError(null);
          });
        }
      } catch (error) {
        console.error("Socket initialization error:", error);
        setError(
          error instanceof Error
            ? error.message
            : "Failed to connect to socket server"
        );
        setIsConnecting(false);
      }
    };

    initSocket();

    return () => {
      if (socket) {
        console.log("Cleaning up socket connection");
        socket.disconnect();
        socket = null;
      }
    };
  }, []);

  return (
    <div style={{ padding: 20 }}>
      <h2>Live Vitals</h2>
      {vitals ? (
        <ul>
          <li>
            <b>Time:</b> {vitals.timestamp}
          </li>
          <li>
            <b>Heart Rate:</b> {vitals.heart_rate} bpm
          </li>
          <li>
            <b>SpO₂:</b> {vitals.spo2} %
          </li>
        </ul>
      ) : (
        <p>Waiting for data...</p>
      )}
    </div>
  );
}
