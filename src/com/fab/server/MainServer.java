package com.fab.server;

import com.sun.net.httpserver.HttpServer;
import java.io.FileInputStream;
import java.io.IOException;
import java.net.InetSocketAddress;
import java.util.Properties;
import java.util.concurrent.Executors;

/**
 * Main entry point for Project FAB Java backend server.
 * Uses Java's built-in HttpServer (no external servlet container needed).
 * Demonstrates Java: OOP, exception handling, modular architecture.
 * Demonstrates SE: separation of concerns, server architecture.
 */
public class MainServer {

    public static void main(String[] args) throws IOException {
        // Load configuration
        Properties props = new Properties();
        try (FileInputStream fis = new FileInputStream("config.properties")) {
            props.load(fis);
        } catch (IOException e) {
            System.out.println("[MainServer] config.properties not found, using defaults.");
        }
        int port = Integer.parseInt(props.getProperty("server.port", "8080"));

        // Create HTTP server
        HttpServer server = HttpServer.create(new InetSocketAddress("0.0.0.0", port), 0);

        // Register route handlers
        server.createContext("/api/auth",        new AuthHandler());
        server.createContext("/api/areas",       new AreaHandler());
        server.createContext("/api/vehicles",    new VehicleHandler());
        server.createContext("/api/collections", new CollectionHandler());
        server.createContext("/api/dashboard",   new CollectionHandler());
        server.createContext("/api/reports",     new ReportHandler());
        server.createContext("/api/analysis",    new AnalysisHandler());
        server.createContext("/api/charts",      new ChartHandler());
        server.createContext("/",                new StaticHandler());

        // Thread pool for handling concurrent requests
        server.setExecutor(Executors.newFixedThreadPool(20));
        server.start();

        System.out.println("╔══════════════════════════════════════════════╗");
        System.out.println("║         PROJECT FAB — Server Started         ║");
        System.out.println("╠══════════════════════════════════════════════╣");
        System.out.printf( "║  URL:  http://localhost:%d                  ║%n", port);
        System.out.println("║  Press Ctrl+C to stop                        ║");
        System.out.println("╚══════════════════════════════════════════════╝");

        // Keep server running
        Runtime.getRuntime().addShutdownHook(new Thread(() -> {
            System.out.println("[MainServer] Shutting down...");
            server.stop(2);
        }));
    }
}
