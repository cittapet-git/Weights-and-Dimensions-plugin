<?php
if (!defined('ABSPATH')) {
    exit;
}

class IP_Arduinos
{
    private $available_ips;

    public function __construct()
    {
        // Available IPs for connection
        $this->available_ips = array(
            array(
                'ip' => 'http://192.168.1.100',
                'name' => 'Mesa Local'
            ),
            array(
                'ip' => 'https://mesapesoymedida.cittapet.com',
                'name' => 'Mesa Remota'
            ),
            array(
                'ip' => 'https://mesapesoymedida.cittapet.com',
                'name' => 'Mesa 3'
            ),
            array(
                'ip' => 'http://192.168.1.101',
                'name' => 'New Device Name'
            ),
            // Add more IPs as needed
        );
    }

    public function get_available_ips()
    {
        return $this->available_ips;
    }
}
