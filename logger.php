<?php
/*
Querys de las tablas de la base de datos

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
    height DECIMAL(10,2),
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

Db:logs
Tabla:  product_weight_dimensions_log
Acciones:
- weight_updated
- dimensions_updated
- weight_dimensions_updated
- weight_dimensions_created
*/


class Logger
{
    private $logs_db;

    public function __construct()
    {
        // Reuse WordPress DB credentials, changing only the database name
        $this->logs_db = new wpdb(DB_USER, DB_PASSWORD, 'logs', DB_HOST);
    }

    public function log_action($product_id, $action, $sku, $weight, $length, $width, $height)
    {
        $user_id = get_current_user_id();
        $user_info = get_userdata($user_id);
        $ip_address = $_SERVER['REMOTE_ADDR'];
        $timestamp = current_time('mysql');

        // Insert log entry into the database
        $this->logs_db->insert(
            'product_weight_dimensions_log',
            array(
                'date' => $timestamp,
                'user_id' => $user_id,
                'username' => $user_info->user_login,
                'ip_address' => $ip_address,
                'action' => $action,
                'product_id' => $product_id,
                'sku' => $sku,
                'weight' => $weight,
                'length' => $length,
                'width' => $width,
                'height' => $height
            ),
            array(
                '%s', // date
                '%d', // user_id
                '%s', // username
                '%s', // ip_address
                '%s', // action
                '%d', // product_id
                '%s', // sku
                '%f', // weight
                '%f', // length
                '%f', // width
                '%f'  // height
            )
        );
    }
}

// Example usage:
/*
$logger = new Logger();
$logger->log_action(
    123, // product_id
    'dimensions_updated',
    'SKU123',
    1.5,  // weight
    10.0, // length
    5.0,  // width
    8.0   // height
);
*/