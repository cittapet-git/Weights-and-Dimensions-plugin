<?php
/*
Plugin Name: Weights and Dimensions Manager
Description: Allows employees to search products by barcode and manage weights and dimensions
Version: 1.0
Author: Sebastián Vera
*/

if (!defined("ABSPATH")) {
    exit();
}

require_once plugin_dir_path(__FILE__) . "logger.php";
require_once plugin_dir_path(__FILE__) . "ip_arduinos.php";

// Enqueue necessary scripts and styles
function pdm_enqueue_scripts($hook)
{
    // Verificar que estamos en la página correcta del plugin
    if ("toplevel_page_product-dimensions-manager" !== $hook) {
        return;
    }

    wp_enqueue_style("pdm-styles", plugins_url("css/style.css", __FILE__));
    wp_enqueue_script(
        "pdm-script",
        plugins_url("js/script.js", __FILE__),
        ["jquery"],
        "1.0",
        true,
    );
    wp_localize_script("pdm-script", "pdm_ajax", [
        "ajax_url" => admin_url("admin-ajax.php"),
        "nonce" => wp_create_nonce("pdm_nonce"),
    ]);
}
add_action("admin_enqueue_scripts", "pdm_enqueue_scripts");

// Add menu item
function pdm_add_menu_page()
{
    add_menu_page(
        "Weights and Dimensions Manager",
        "Weights and Dimensions",
        "manage_options",
        "product-dimensions-manager",
        "pdm_render_page",
        "dashicons-products",
        30,
    );
}
add_action("admin_menu", "pdm_add_menu_page");

// Render the main plugin page
function pdm_render_page()
{
    ?>
    <div class="wrap">


        <div class="pdm-container">
            <div class="pdm-search-section">
                <div class="pdm-search-header">
                    <h2>Buscar Codigo o Nombre:</h2>
                    <div class="pdm-connection-indicator">
                        <span class="pdm-status-text disconnected">Sin conexión</span>
                        <div class="pdm-status-light disconnected" title="Estado de conexión"></div>
                        <div class="pdm-ip-info" style="display: none;">
                            <span class="pdm-current-ip"></span>
                            <button class="pdm-edit-ip" title="Editar IP">
                                <span class="dashicons dashicons-edit"></span>
                            </button>
                            <input type="text" class="pdm-ip-input" placeholder="Ingrese IP">

                        </div>
                    </div>
                </div>
                <div class="search-input-wrapper">
                    <input type="text"
                        id="pdm-barcode-input"
                        placeholder="Ingrese código o nombre del producto...">
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
                        <h2 id="pdm-product-title"></h2>
                        <p>SKU: <span id="pdm-product-sku"></span></p>
                        <p>Precio: $<span id="pdm-price"></span></p>

                    </div>
                </div>

                <div class="pdm-dimensions-form">
                    <div class="pdm-form-row" id="pdm-weight-row">
                        <label>Weight (kg):</label>
                        <div class="pdm-input-group">
                            <input type="number" id="pdm-weight" step="0.01">
                            <div class="pdm-button-group">
                                <button type="button" class="button measure-btn" data-type="weight">
                                    <span class="dashicons dashicons-arrow-down-alt"></span>
                                </button>
                                <button type="button" class="button stop-measure-btn" style="display: none;">
                                    Detener
                                </button>
                            </div>
                        </div>
                    </div>
                    <div class="pdm-dimensions-group">
                        <h3>Dimensions (cm)</h3>
                        <div class="pdm-form-row">
                            <label>Length:</label>
                            <div class="pdm-input-group">
                                <input type="number" id="pdm-length" step="0.01">
                                <div class="pdm-button-group">
                                    <button type="button" class="button measure-btn" data-type="length">
                                        <span class="dashicons dashicons-arrow-down-alt"></span>
                                    </button>
                                    <button type="button" class="button stop-measure-btn" style="display: none;">
                                        Detener
                                    </button>
                                </div>
                            </div>
                        </div>
                        <div class="pdm-form-row">
                            <label>Width:</label>
                            <div class="pdm-input-group">
                                <input type="number" id="pdm-width" step="0.01">
                                <div class="pdm-button-group">
                                    <button type="button" class="button measure-btn" data-type="width">
                                        <span class="dashicons dashicons-arrow-down-alt"></span>
                                    </button>
                                    <button type="button" class="button stop-measure-btn" style="display: none;">
                                        Detener
                                    </button>
                                </div>
                            </div>
                        </div>
                        <div class="pdm-form-row">
                            <label>Height:</label>
                            <div class="pdm-input-group">
                                <input type="number" id="pdm-height" step="0.01">
                                <div class="pdm-button-group">
                                    <button type="button" class="button measure-btn" data-type="height">
                                        <span class="dashicons dashicons-arrow-down-alt"></span>
                                    </button>
                                    <button type="button" class="button stop-measure-btn" style="display: none;">
                                        Detener
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                    <div class="pdm-form-actions">
                        <button class="button button-primary button-large pdm-save-all">
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
    check_ajax_referer("pdm_nonce", "nonce");

    $search = sanitize_text_field($_POST["search"]);
    $search_upper = strtoupper($search); // Convertir a mayúsculas para la búsqueda

    $results = [];

    try {
        global $wpdb;

        if (is_numeric($search)) {
            if (strlen($search) >= 10) {
                // Búsqueda por código de barras (sin cambios)
                $args = [
                    "post_type" => "product",
                    "posts_per_page" => 10,
                    "meta_query" => [
                        [
                            "key" => "_global_unique_id",
                            "value" => $search,
                            "compare" => "=",
                        ],
                    ],
                ];
            } else {
                // Búsqueda directa en postmeta para SKU numérico
                $product_ids = $wpdb->get_col(
                    $wpdb->prepare(
                        "
                    SELECT post_id
                    FROM {$wpdb->postmeta}
                    WHERE meta_key = '_sku'
                    AND UPPER(meta_value) LIKE %s",
                        "%" . $wpdb->esc_like($search_upper) . "%",
                    ),
                );
            }
        } else {
            // Búsqueda directa en postmeta para SKU alfanumérico
            $product_ids = $wpdb->get_col(
                $wpdb->prepare(
                    "
                SELECT DISTINCT post_id
                FROM {$wpdb->postmeta}
                WHERE meta_key = '_sku'
                AND (
                    UPPER(meta_value) LIKE %s
                    OR UPPER(meta_value) = %s
                )",
                    "%" . $wpdb->esc_like($search_upper) . "%",
                    $search_upper,
                ),
            );

            // Si no hay resultados por SKU, buscar por título
            if (empty($product_ids)) {
                $args = [
                    "post_type" => "product",
                    "posts_per_page" => 10,
                    "orderby" => "title",
                    "order" => "ASC",
                    "s" => $search,
                ];
            }
        }

        // Si tenemos IDs de productos de la búsqueda directa
        if (!empty($product_ids)) {
            $args = [
                "post_type" => "product",
                "post__in" => $product_ids,
                "posts_per_page" => 10,
                "orderby" => "post__in",
            ];
        }

        if (isset($args)) {
            $query = new WP_Query($args);

            if ($query->have_posts()) {
                while ($query->have_posts()) {
                    $query->the_post();
                    $product = wc_get_product(get_the_ID());
                    if ($product) {
                        $dimensions = wc_format_dimensions(
                            $product->get_dimensions(false),
                        );
                        $dimensions_array = array_map(
                            "floatval",
                            $product->get_dimensions(false),
                        );

                        $results[] = [
                            "id" => $product->get_id(),
                            "title" => $product->get_name(),
                            "sku" => $product->get_sku(),
                            "image" => get_the_post_thumbnail_url(
                                get_the_ID(),
                                "thumbnail",
                            ),
                            "meta" => sprintf(
                                "SKU: %s | Precio: %s",
                                $product->get_sku(),
                                wc_price($product->get_price()),
                            ),
                            "weight" => $product->get_weight(),
                            "length" => $dimensions_array["length"] ?? "",
                            "width" => $dimensions_array["width"] ?? "",
                            "height" => $dimensions_array["height"] ?? "",
                            "price" => $product->get_price(),
                        ];
                    }
                }
                wp_reset_postdata();
            }
        }

        wp_send_json_success($results);
    } catch (Exception $e) {
        wp_send_json_error("Error al buscar productos: " . $e->getMessage());
    }
}
add_action("wp_ajax_pdm_search_product", "pdm_search_product");

// AJAX handler para guardar las dimensiones y peso
function pdm_save_dimensions()
{
    check_ajax_referer("pdm_nonce", "nonce");

    // Verificar permisos
    if (!current_user_can("edit_products")) {
        wp_send_json_error("No tienes permisos para editar productos");
    }

    $product_id = intval($_POST["product_id"]);
    $weight = floatval($_POST["weight"]);
    $length = floatval($_POST["length"]);
    $width = floatval($_POST["width"]);
    $height = floatval($_POST["height"]);

    try {
        $product = wc_get_product($product_id);

        if (!$product) {
            throw new Exception("Producto no encontrado");
        }

        // Get original values to determine what changed
        $original_weight = floatval($product->get_weight());
        $original_length = floatval($product->get_length());
        $original_width = floatval($product->get_width());
        $original_height = floatval($product->get_height());

        // Verificar si hubo cambios
        $weight_changed = $weight !== $original_weight;
        $dimensions_changed =
            $length !== $original_length ||
            $width !== $original_width ||
            $height !== $original_height;

        // Si no hay cambios, retornar éxito sin hacer nada
        if (!$weight_changed && !$dimensions_changed) {
            wp_send_json_success([
                "message" => "No hay cambios que guardar",
                "weight" => $weight,
                "dimensions" => [
                    "length" => $length,
                    "width" => $width,
                    "height" => $height,
                ],
            ]);
            return;
        }

        // Actualizar dimensiones y peso
        $product->set_weight($weight);
        $product->set_length($length);
        $product->set_width($width);
        $product->set_height($height);

        // Guardar los cambios
        $product->save();

        // Determine what changed and log accordingly
        $logger = new Logger();
        $sku = $product->get_sku();

        // Determine what action to log based on what changed
        if (
            $original_weight === 0 &&
            $original_length === 0 &&
            $original_width === 0 &&
            $original_height === 0
        ) {
            // If all original values were zero, this is a creation
            $action = "weight_dimensions_created";
        } elseif ($weight_changed && $dimensions_changed) {
            // Both weight and dimensions changed
            $action = "weight_dimensions_updated";
        } elseif ($weight_changed) {
            // Only weight changed
            $action = "weight_updated";
        } else {
            // Only dimensions changed
            $action = "dimensions_updated";
        }

        // Log the action with all values
        $logger->log_action(
            $product_id,
            $action,
            $sku,
            $weight,
            $length,
            $width,
            $height,
        );

        wp_send_json_success([
            "message" => "Datos actualizados correctamente",
            "weight" => $weight,
            "dimensions" => [
                "length" => $length,
                "width" => $width,
                "height" => $height,
            ],
        ]);
    } catch (Exception $e) {
        wp_send_json_error("Error al guardar los datos: " . $e->getMessage());
    }
}
add_action("wp_ajax_pdm_save_dimensions", "pdm_save_dimensions");

// Agregar después de los otros add_action
add_action("wp_ajax_pdm_get_ips", "pdm_get_available_ips");

function pdm_get_available_ips()
{
    check_ajax_referer("pdm_nonce", "nonce");

    $ip_manager = new IP_Arduinos();
    $available_ips = $ip_manager->get_available_ips();

    wp_send_json_success($available_ips);
}
