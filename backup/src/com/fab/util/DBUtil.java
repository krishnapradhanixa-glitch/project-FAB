package com.fab.util;

import java.io.FileInputStream;
import java.io.IOException;
import java.sql.Connection;
import java.sql.DriverManager;
import java.sql.SQLException;
import java.util.Properties;

/**
 * Database connection utility using JDBC.
 * Demonstrates DBMS: JDBC connectivity, connection management.
 */
public class DBUtil {
    private static String url;
    private static String user;
    private static String password;
    private static String driver;

    static {
        try {
            Properties props = new Properties();
            // Try loading from working directory first, then classpath
            try (FileInputStream fis = new FileInputStream("config.properties")) {
                props.load(fis);
            } catch (IOException e) {
                // fallback defaults
                props.setProperty("db.url", "jdbc:mysql://localhost:3306/projectfab?useSSL=false&serverTimezone=UTC&allowPublicKeyRetrieval=true");
                props.setProperty("db.user", "root");
                props.setProperty("db.password", "root");
                props.setProperty("db.driver", "com.mysql.cj.jdbc.Driver");
            }
            url      = props.getProperty("db.url");
            user     = props.getProperty("db.user");
            password = props.getProperty("db.password");
            driver   = props.getProperty("db.driver");
            Class.forName(driver);
        } catch (ClassNotFoundException e) {
            throw new RuntimeException("MySQL JDBC Driver not found. Add mysql-connector-java.jar to lib/", e);
        }
    }

    /** Returns a new JDBC connection. Caller is responsible for closing it. */
    public static Connection getConnection() throws SQLException {
        return DriverManager.getConnection(url, user, password);
    }

    /** Silently close a connection. */
    public static void close(AutoCloseable... resources) {
        for (AutoCloseable r : resources) {
            if (r != null) {
                try { r.close(); } catch (Exception ignored) {}
            }
        }
    }
}
