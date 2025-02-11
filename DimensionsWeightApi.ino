/*
 * API REST para Sistema de Medición de Dimensiones y Peso
 * ====================================================
 * 
 * Este sketch implementa un servidor web REST API que proporciona
 * información sobre mediciones de peso y dimensiones a través de HTTP.
 * 
 * Endpoints disponibles:
 * ---------------------
 * GET /ip        - Devuelve la dirección IP actual del dispositivo
 * GET /weight    - Devuelve una medición de peso en kilogramos
 * GET /dimension - Devuelve una medición de dimensión en centímetros
 * 
 * Respuestas:
 * ----------
 * Todas las respuestas son en formato JSON
 * Ejemplo /ip:        {"ip": "192.168.1.100"}
 * Ejemplo /weight:    {"peso_kg": 5.43}
 * Ejemplo /dimension: {"dimension_cm": 25.6}
 * 
 * Configuración de Red:
 * -------------------
 * - Utiliza Ethernet Shield para la conectividad
 * - Configuración DHCP automática
 * - Puerto HTTP: 80
 * 
 * Conexiones de Hardware:
 * ---------------------
 * - Pin A10: Sensor de dimensiones (entrada analógica)
 * - Ethernet Shield conectado a los pines SPI estándar
 * 
 * Dependencias:
 * -----------
 * - Biblioteca Ethernet
 * - Biblioteca ArduinoJson
 */

#include <Ethernet.h>
#include <ArduinoJson.h>

// Configuración de la red
byte mac[] = { 0xDE, 0xAD, 0xBE, 0xEF, 0xFE, 0xED };
IPAddress ip(192, 168, 1, 100); // Dirección IP de tu Arduino
EthernetServer server(80); // Puerto 80 para HTTP

void setup() {
  Serial.begin(9600);
  Serial.println("Iniciando configuración...");
  
  // Iniciar Ethernet con MAC e IP estática
  // Serial.println("Configurando conexión Ethernet...");
  // if (Ethernet.begin(mac) == 0) {
  //   Serial.println("Error: No se pudo configurar Ethernet usando DHCP");
  //   while(true); // No continuar
  // }
  Ethernet.begin(mac, ip);  // Usar IP estática en lugar de DHCP
  Serial.println("Conexión Ethernet establecida");

  // Iniciar servidor
  server.begin();
  Serial.print("Servidor iniciado en IP: ");
  Serial.println(Ethernet.localIP());
  Serial.println("Setup completado. Esperando conexiones...\n");
}

void loop() {
  EthernetClient client = server.available();
  if (client) {
    Serial.println("Nueva conexión detectada");
    String request = client.readStringUntil('\r');
    
    // Ignorar solicitudes de favicon.ico y solicitudes vacías
    if (request.indexOf("favicon.ico") > -1 || request.length() < 3) {
      client.stop();
      return;
    }
    
    Serial.println("Solicitud recibida: " + request);
    
    // Manejar peticiones OPTIONS para CORS
    if (request.indexOf("OPTIONS") > -1) {
      client.println("HTTP/1.1 200 OK");
      client.println("Access-Control-Allow-Origin: *");
      client.println("Access-Control-Allow-Methods: GET");
      client.println("Access-Control-Allow-Headers: Content-Type");
      client.println("Content-Type: application/json");
      client.println();
      client.stop();
      return;
    }
    
    // Analizar la solicitud HTTP y determinar el endpoint
    if (request.indexOf("GET /ip") > -1) {
      enviarIP(client);
    } else if (request.indexOf("GET /weight") > -1) {
      enviarPeso(client);
    } else if (request.indexOf("GET /dimension") > -1) {
      enviarDimension(client);
    } else {
      enviarError(client);
    }
    client.stop();
    Serial.println("Conexión cerrada\n");
  }
}

void enviarIP(EthernetClient client) {
  StaticJsonDocument<200> doc;
  
  // Convertir IP a String manualmente
  String ipString = String(Ethernet.localIP()[0]) + "." +
                   String(Ethernet.localIP()[1]) + "." +
                   String(Ethernet.localIP()[2]) + "." +
                   String(Ethernet.localIP()[3]);
  
  doc["ip"] = ipString;
  
  Serial.println("Enviando IP: " + ipString);
  
  client.println("HTTP/1.1 200 OK");
  client.println("Access-Control-Allow-Origin: *");
  client.println("Access-Control-Allow-Methods: GET");
  client.println("Access-Control-Allow-Headers: Content-Type");
  client.println("Content-Type: application/json");
  client.println();
  serializeJson(doc, client);
}

void enviarPeso(EthernetClient client) {
  float peso = random(1000) / 100.0; // Genera un número aleatorio entre 0.00 y 9.99 kg
  
  StaticJsonDocument<200> doc;
  doc["peso_kg"] = peso;
  
  Serial.println("Enviando peso: " + String(peso) + " kg");
  
  client.println("HTTP/1.1 200 OK");
  client.println("Access-Control-Allow-Origin: *");
  client.println("Access-Control-Allow-Methods: GET");
  client.println("Access-Control-Allow-Headers: Content-Type");
  client.println("Content-Type: application/json");
  client.println();
  serializeJson(doc, client);
}

void enviarDimension(EthernetClient client) {
  float dimension = analogRead(A10) * (5.0 / 1023.0); // Convierte la lectura a voltaje
  
  StaticJsonDocument<200> doc;
  doc["dimension_cm"] = dimension;
  
  Serial.println("Enviando dimensión: " + String(dimension) + " cm");
  
  client.println("HTTP/1.1 200 OK");
  client.println("Access-Control-Allow-Origin: *");
  client.println("Access-Control-Allow-Methods: GET");
  client.println("Access-Control-Allow-Headers: Content-Type");
  client.println("Content-Type: application/json");
  client.println();
  serializeJson(doc, client);
}

void enviarError(EthernetClient client) {
  client.println("HTTP/1.1 404 Not Found");
  client.println();
  client.println("Error: Endpoint no encontrado");
}