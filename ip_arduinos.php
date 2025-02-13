 <?php
    if (!defined('ABSPATH')) {
        exit;
    }

    class IP_Arduinos
    {
        private $available_ips;

        public function __construct()
        {
            // IPs disponibles para conexión
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
                // Agregar más IPs según sea necesario
            );
        }

        public function get_available_ips()
        {
            return $this->available_ips;
        }
    }
