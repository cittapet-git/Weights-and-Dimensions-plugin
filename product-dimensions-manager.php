<?php
/*
Plugin Name: Pesos y Dimensiones
Description: Allows employees to search products by barcode and manage weights and dimensions
Version: 1.0
Author: Sebastián Vera
*/

if (!defined("ABSPATH")) {
    exit();
}

require_once plugin_dir_path(__FILE__) . "ip_arduinos.php";

// Enqueue necessary scripts and styles
function pdm_enqueue_scripts($hook)
{
    // Verificar que estamos en la página correcta del plugin
    if ("toplevel_page_product-dimensions-manager" !== $hook) {
        return;
    }

    wp_enqueue_style("pdm-styles", plugins_url("css/style.css", __FILE__));

    // Enqueue SweetAlert2
    wp_enqueue_style(
        "sweetalert2-css",
        "https://cdn.jsdelivr.net/npm/sweetalert2@11/dist/sweetalert2.min.css",
        [],
        "11",
    );
    wp_enqueue_script(
        "sweetalert2-js",
        "https://cdn.jsdelivr.net/npm/sweetalert2@11/dist/sweetalert2.min.js",
        [],
        "11",
        true,
    );

    wp_enqueue_script(
        "pdm-script",
        plugins_url("js/script.js", __FILE__),
        ["jquery", "sweetalert2-js"],
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
        "Pesos y Dimensiones",
        "Pesos y Dimensiones",
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
                    <button type="button" class="button button-primary" id="pdm-search-btn" title="Buscar producto directamente">
                        <span class="dashicons dashicons-search"></span>
                    </button>
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
    error_log(
        "[PDM] Search product request - Search term: " .
            sanitize_text_field($_POST["search"] ?? ""),
    );
    check_ajax_referer("pdm_nonce", "nonce");

    $search = sanitize_text_field($_POST["search"]);
    $is_direct_search =
        isset($_POST["direct_search"]) && $_POST["direct_search"] === "true";
    $results = [];

    try {
        // For direct search, prioritize exact matches and return first match immediately
        if ($is_direct_search) {
            $product = pdm_find_exact_product($search);
            if ($product) {
                $results = [pdm_format_product_result($product)];
                error_log("[PDM] Direct search success - Found exact match");
                wp_send_json_success($results);
                return;
            }
        }

        // Regular search for suggestions
        $results = pdm_search_products_by_criteria(
            $search,
            $is_direct_search ? 1 : 10,
        );

        error_log(
            "[PDM] Search product success - Found " .
                count($results) .
                " results",
        );
        wp_send_json_success($results);
    } catch (Exception $e) {
        error_log("[PDM] Search product error: " . $e->getMessage());
        wp_send_json_error("Error al buscar productos: " . $e->getMessage());
    }
}

// Helper function to find exact product match
function pdm_find_exact_product($search)
{
    // Try exact SKU match first
    $products = wc_get_products([
        "limit" => 1,
        "meta_key" => "_sku",
        "meta_value" => $search,
        "meta_compare" => "=",
        "status" => "publish",
    ]);

    if (!empty($products)) {
        return $products[0];
    }

    // Try barcode match if numeric and long enough
    if (is_numeric($search) && strlen($search) >= 10) {
        $products = wc_get_products([
            "limit" => 1,
            "meta_key" => "_global_unique_id",
            "meta_value" => $search,
            "meta_compare" => "=",
            "status" => "publish",
        ]);

        if (!empty($products)) {
            return $products[0];
        }
    }

    // Try product ID if numeric
    if (is_numeric($search)) {
        $product = wc_get_product($search);
        if ($product && $product->get_status() === "publish") {
            return $product;
        }
    }

    return null;
}

// Helper function to search products by multiple criteria
function pdm_search_products_by_criteria($search, $limit = 10)
{
    $results = [];

    // 1. Exact SKU matches first
    $products = wc_get_products([
        "limit" => $limit,
        "meta_key" => "_sku",
        "meta_value" => $search,
        "meta_compare" => "=",
        "status" => "publish",
    ]);

    foreach ($products as $product) {
        $results[] = pdm_format_product_result($product);
    }

    // If we have enough results, return them
    if (count($results) >= $limit) {
        return array_slice($results, 0, $limit);
    }

    // 2. Partial SKU matches
    if (count($results) < $limit) {
        $remaining = $limit - count($results);
        $products = wc_get_products([
            "limit" => $remaining * 2, // Get more to filter duplicates
            "meta_key" => "_sku",
            "meta_value" => $search,
            "meta_compare" => "LIKE",
            "status" => "publish",
        ]);

        $existing_ids = array_column($results, "id");
        foreach ($products as $product) {
            if (
                !in_array($product->get_id(), $existing_ids) &&
                count($results) < $limit
            ) {
                $results[] = pdm_format_product_result($product);
            }
        }
    }

    // 3. Barcode search for numeric values
    if (
        count($results) < $limit &&
        is_numeric($search) &&
        strlen($search) >= 10
    ) {
        $remaining = $limit - count($results);
        $products = wc_get_products([
            "limit" => $remaining,
            "meta_key" => "_global_unique_id",
            "meta_value" => $search,
            "meta_compare" => "=",
            "status" => "publish",
        ]);

        $existing_ids = array_column($results, "id");
        foreach ($products as $product) {
            if (
                !in_array($product->get_id(), $existing_ids) &&
                count($results) < $limit
            ) {
                $results[] = pdm_format_product_result($product);
            }
        }
    }

    // 4. Title search as fallback
    if (count($results) < $limit) {
        $remaining = $limit - count($results);
        $products = wc_get_products([
            "limit" => $remaining * 2,
            "name" => $search,
            "status" => "publish",
        ]);

        $existing_ids = array_column($results, "id");
        foreach ($products as $product) {
            if (
                !in_array($product->get_id(), $existing_ids) &&
                count($results) < $limit
            ) {
                $results[] = pdm_format_product_result($product);
            }
        }
    }

    return $results;
}

// Helper function to format product result
function pdm_format_product_result($product)
{
    $dimensions_array = array_map("floatval", $product->get_dimensions(false));

    return [
        "id" => $product->get_id(),
        "title" => $product->get_name(),
        "sku" => $product->get_sku(),
        "image" => get_the_post_thumbnail_url($product->get_id(), "thumbnail"),
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
add_action("wp_ajax_pdm_search_product", "pdm_search_product");

// AJAX handler para guardar las dimensiones y peso
function pdm_save_dimensions()
{
    error_log(
        "[PDM] Save dimensions request - Product ID: " .
            intval($_POST["product_id"] ?? 0) .
            ", Weight: " .
            floatval($_POST["weight"] ?? 0) .
            ", Dimensions: " .
            floatval($_POST["length"] ?? 0) .
            "x" .
            floatval($_POST["width"] ?? 0) .
            "x" .
            floatval($_POST["height"] ?? 0),
    );
    check_ajax_referer("pdm_nonce", "nonce");

    // Verificar permisos
    if (!current_user_can("edit_products")) {
        error_log("[PDM] Save dimensions error: User lacks permissions");
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

        error_log("[PDM] Save dimensions success - Product ID: $product_id");
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
        error_log("[PDM] Save dimensions error: " . $e->getMessage());
        wp_send_json_error("Error al guardar los datos: " . $e->getMessage());
    }
}
add_action("wp_ajax_pdm_save_dimensions", "pdm_save_dimensions");

// Agregar después de los otros add_action
add_action("wp_ajax_pdm_get_ips", "pdm_get_available_ips");

function pdm_get_available_ips()
{
    error_log("[PDM] Get available IPs request");
    check_ajax_referer("pdm_nonce", "nonce");

    $ip_manager = new IP_Arduinos();
    $available_ips = $ip_manager->get_available_ips();

    error_log(
        "[PDM] Get available IPs success - Found " .
            count($available_ips) .
            " IPs",
    );
    wp_send_json_success($available_ips);
}
