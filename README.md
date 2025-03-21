# Weights and Dimensions Manager

A WordPress plugin for managing product weights and dimensions with Arduino integration.

## Description

This plugin allows employees to search for products by barcode or name and manage their weights and dimensions. It connects to Arduino devices that provide real-time weight and dimension measurements.

## Features

- Search products by barcode, SKU, or name
- Barcode scanner support
- Connect to Arduino devices for measurements
- Real-time weight and dimension readings
- Save measurements to WooCommerce products
- Keyboard shortcuts for efficient workflow
- Logging of all measurement changes

## Requirements

- WordPress 5.0+
- WooCommerce 4.0+
- MySQL/MariaDB with a separate `logs` database
- Arduino devices with compatible API endpoints

## Installation

1. Upload the plugin files to the `/wp-content/plugins/weights-and-dimensions-manager` directory
2. Activate the plugin through the 'Plugins' screen in WordPress
3. Create a separate database named `logs` with the required table structure
4. Configure Arduino devices to expose the required API endpoints
5. Access the plugin via the "Weights and Dimensions" menu item

## Configuration

### Adding Arduino Devices

Edit the `ip_arduinos.php` file to add or modify available Arduino devices.

### Database Setup

Create a separate database named `logs` and run the following SQL:

CREATE TABLE IF NOT EXISTS product_weight_dimensions_log (
id INT AUTO_INCREMENT PRIMARY KEY,
date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
user_id BIGINT(20) NOT NULL,
username VARCHAR(255) NOT NULL,
ip_address VARCHAR(45) NOT NULL,
action VARCHAR(50) NOT NULL,
product_id BIGINT(20) NOT NULL,
sku VARCHAR(100),
weight DECIMAL(10,2),
length DECIMAL(10,2),
width DECIMAL(10,2),
height DECIMAL(10,2)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

## Usage

1. Navigate to "Weights and Dimensions" in the WordPress admin menu
2. Search for a product by barcode, SKU, or name
3. Connect to an Arduino device by clicking the connection indicator
4. Use the measurement buttons to get weight and dimensions
5. Save changes with the "Save Changes" button

## Keyboard Shortcuts

- **Space**: Start/stop measurement for the selected field
- **Arrow Up/Down**: Navigate between measurement fields
- **Enter**: Save all changes

## Arduino API Requirements

The Arduino devices must expose the following endpoints:

- `/ip.php`: Returns the device's IP address for connection verification
- `/weight.php`: Returns the current weight measurement
- `/dimensions.php`: Returns the current dimension measurement

## License

This plugin is licensed under the GPL v2 or later.
