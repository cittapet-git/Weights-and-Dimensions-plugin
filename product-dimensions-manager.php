<?php
/*
Plugin Name: Weights and Dimensions Manager
Description: Allows employees to search products by barcode and manage weights and dimensions
Version: 1.0
Author: Your Name
*/

if (!defined('ABSPATH')) {
    exit;
}

// Enqueue necessary scripts and styles
function pdm_enqueue_scripts()
{
    wp_enqueue_style('pdm-styles', plugins_url('css/style.css', __FILE__));
    wp_enqueue_script('pdm-script', plugins_url('js/script.js', __FILE__), array('jquery'), '1.0', true);
    wp_localize_script('pdm-script', 'pdm_ajax', array(
        'ajax_url' => admin_url('admin-ajax.php'),
        'nonce' => wp_create_nonce('pdm_nonce')
    ));
}
add_action('admin_enqueue_scripts', 'pdm_enqueue_scripts');

// Add menu item
function pdm_add_menu_page()
{
    add_menu_page(
        'Weights and Dimensions Manager',
        'Weights and Dimensions',
        'manage_options',
        'product-dimensions-manager',
        'pdm_render_page',
        'dashicons-products',
        30
    );
}
add_action('admin_menu', 'pdm_add_menu_page');

// Render the main plugin page
function pdm_render_page()
{
?>
    <div class="wrap">
        <h1>Product Dimensions Manager</h1>
        <div class="pdm-container">
            <div class="pdm-search-section">
                <h2>Buscar Codigo o Nombre:</h2>
                <div class="search-input-wrapper">
                    <input type="text"
                        id="pdm-barcode-input"
                        placeholder="Ingrese código o nombre del producto..."
                        style="width: 100%; font-size: 16px; padding: 10px;">
                    <div class="pdm-spinner"></div>
                </div>
                <div class="pdm-suggestions"></div>
            </div>

            <div class="pdm-product-info" style="display: none;">
                <div class="pdm-product-header">
                    <div class="pdm-product-image">
                        <img src="" alt="Product Image" id="pdm-product-image" style="max-width: 200px; height: auto;">
                    </div>
                    <div class="pdm-product-details">
                        <h2 id="pdm-product-title" style="font-size: 24px; margin-bottom: 10px;"></h2>
                        <p style="font-size: 16px;">SKU: <span id="pdm-product-sku"></span></p>
                    </div>
                </div>

                <div class="pdm-dimensions-form">
                    <div class="pdm-form-row" style="margin-bottom: 20px;">
                        <label style="font-size: 18px; min-width: 100px;">Weight (kg):</label>
                        <input type="number" id="pdm-weight" step="0.01" style="font-size: 18px; width: 150px; padding: 8px;">
                        <button type="button" class="button measure-btn" data-type="weight" style="height: 40px; margin-left: 10px;">
                            <span class="dashicons dashicons-arrow-down-alt"></span>
                        </button>
                        <button type="button" class="button stop-measure-btn" style="display: none; height: 40px; margin-left: 10px;">
                            Detener
                        </button>
                    </div>
                    <div class="pdm-dimensions-group" style="border: 1px solid #ddd; padding: 20px; border-radius: 5px; background: #f9f9f9;">
                        <h3 style="margin-top: 0; margin-bottom: 20px;">Dimensions (cm)</h3>
                        <div class="pdm-form-row" style="margin-bottom: 20px;">
                            <label style="font-size: 18px; min-width: 100px;">Length:</label>
                            <input type="number" id="pdm-length" step="0.01" style="font-size: 18px; width: 150px; padding: 8px;">
                            <button type="button" class="button measure-btn" data-type="length" style="height: 40px; margin-left: 10px;">
                                <span class="dashicons dashicons-arrow-down-alt"></span>
                            </button>
                            <button type="button" class="button stop-measure-btn" style="display: none; height: 40px; margin-left: 10px;">
                                Detener
                            </button>
                        </div>
                        <div class="pdm-form-row" style="margin-bottom: 20px;">
                            <label style="font-size: 18px; min-width: 100px;">Width:</label>
                            <input type="number" id="pdm-width" step="0.01" style="font-size: 18px; width: 150px; padding: 8px;">
                            <button type="button" class="button measure-btn" data-type="width" style="height: 40px; margin-left: 10px;">
                                <span class="dashicons dashicons-arrow-down-alt"></span>
                            </button>
                            <button type="button" class="button stop-measure-btn" style="display: none; height: 40px; margin-left: 10px;">
                                Detener
                            </button>
                        </div>
                        <div class="pdm-form-row" style="margin-bottom: 20px;">
                            <label style="font-size: 18px; min-width: 100px;">Height:</label>
                            <input type="number" id="pdm-height" step="0.01" style="font-size: 18px; width: 150px; padding: 8px;">
                            <button type="button" class="button measure-btn" data-type="height" style="height: 40px; margin-left: 10px;">
                                <span class="dashicons dashicons-arrow-down-alt"></span>
                            </button>
                            <button type="button" class="button stop-measure-btn" style="display: none; height: 40px; margin-left: 10px;">
                                Detener
                            </button>
                        </div>
                    </div>
                    <div class="pdm-form-actions" style="margin-top: 20px; text-align: right;">
                        <button class="button button-primary button-large pdm-save-all" style="font-size: 16px; padding: 8px 20px;">
                            Save Changes
                        </button>
                    </div>
                </div>
            </div>
        </div>
    </div>
<?php
}

// AJAX handler for barcode search
function pdm_search_product()
{
    check_ajax_referer('pdm_nonce', 'nonce');

    $search = sanitize_text_field($_POST['search']);

    $results = array();

    try {
        // Buscar por ID/SKU, código de barras o por título
        if (is_numeric($search)) {
            if (strlen($search) > 12) {
                // Búsqueda por código de barras
                $args = array(
                    'post_type' => 'product',
                    'posts_per_page' => 10,
                    'meta_query' => array(
                        array(
                            'key' => '_global_unique_id',
                            'value' => $search,
                            'compare' => '='
                        )
                    )
                );
            } else {
                // Búsqueda por SKU
                $args = array(
                    'post_type' => 'product',
                    'posts_per_page' => 10,
                    'meta_query' => array(
                        array(
                            'key' => '_sku',
                            'value' => $search,
                            'compare' => 'LIKE'
                        )
                    )
                );
            }
        } else {
            // Búsqueda por título
            $args = array(
                'post_type' => 'product',
                'posts_per_page' => 10,
                'orderby' => 'title',
                'order' => 'ASC',
                's' => $search
            );
        }

        $query = new WP_Query($args);

        if ($query->have_posts()) {
            while ($query->have_posts()) {
                $query->the_post();
                $product = wc_get_product(get_the_ID());
                if ($product) {
                    $dimensions = wc_format_dimensions($product->get_dimensions(false)); // Get raw dimensions
                    $dimensions_array = array_map('floatval', $product->get_dimensions(false));

                    $results[] = array(
                        'id' => $product->get_id(),
                        'title' => $product->get_name(),
                        'sku' => $product->get_sku(),
                        'image' => get_the_post_thumbnail_url(get_the_ID(), 'thumbnail'),
                        'meta' => sprintf(
                            'SKU: %s | Precio: %s',
                            $product->get_sku(),
                            wc_price($product->get_price())
                        ),
                        'weight' => $product->get_weight(),
                        'length' => $dimensions_array['length'] ?? '',
                        'width' => $dimensions_array['width'] ?? '',
                        'height' => $dimensions_array['height'] ?? ''
                    );
                }
            }
            wp_reset_postdata();
        }

        wp_send_json_success($results);
    } catch (Exception $e) {
        wp_send_json_error('Error al buscar productos');
    }
}
add_action('wp_ajax_pdm_search_product', 'pdm_search_product');
