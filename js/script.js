/*
 * OPTIMIZACIONES IMPLEMENTADAS:
 * - Conexiones cada 5 minutos (antes 30 segundos)
 * - Cache de mediciones (5 segundos) y conexiones (5 minutos)
 * - Bloqueo de conexiones externas (solo localhost permitido)
 * - Delay entre mediciones aumentado a 2 segundos (antes 400ms)
 * - Cache se limpia al cambiar de producto
 */
const DEBUG_MODE = true;
const ALLOW_EXTERNAL_CONNECTIONS = false; // SEGURIDAD: Cambiar a true solo si necesitas conexiones externas
jQuery(document).ready(function($) {
    // Configuración del modo debug
     // Cambiar a false para deshabilitar logs

    // Función helper para logs
    function debug(...args) {
        if (DEBUG_MODE) {
            console.log(...args);
        }
    }

    // Función helper para errores
    function debugError(...args) {
        if (DEBUG_MODE) {
            console.error(...args);
        }
    }

    // Configuración inicial del servidor que maneja las mediciones
    const MEASUREMENT_SERVER = {
        host: '',
        endpoints: {
            weight: '/weight.php',      // Endpoint para obtener peso
            dimension: '/dimensions.php', // Endpoint para obtener dimensiones
            ip:'/ip.php'               // Endpoint para verificar conexión
        }
    };
    
    // Referencias a elementos DOM frecuentemente utilizados
    const barcodeInput = $('#pdm-barcode-input');    // Input para código de barras
    const productInfo = $('.pdm-product-info');      // Contenedor de info del producto
    const suggestions = $('.pdm-suggestions');        // Contenedor de sugerencias
    const spinner = $('.pdm-spinner');               // Indicador de carga

    // Variables para el manejo del scanner de códigos de barras
    let lastKeyTime = 0;            // Último tiempo que se presionó una tecla
    let barcodeBuffer = '';         // Buffer para almacenar el código escaneado
    const BARCODE_DELAY = 50;       // Delay máximo entre teclas para considerar entrada de scanner
    let isScanning = false;         // Indica si estamos en proceso de escaneo

    // Variables para control de medición
    let currentField = null;        // Campo actualmente seleccionado
    let isMeasuring = false;        // Indica si hay una medición en curso

    // Control de secuencia de medición
    let currentMeasurement = null;  // Medición actual en la secuencia
    const measurementSequence = ['weight', 'length', 'width', 'height']; // Orden de medición
    let cycleCompleted = false;     // Indica si se completó el ciclo de mediciones

    // Variable para el intervalo de verificación de conexión
    let connectionCheckInterval;

    // Función para actualizar el estado visual de la conexión
    function updateConnectionStatus(status, message = '') {
        const statusLight = $('.pdm-status-light');
        const statusText = $('.pdm-status-text');
        
        debug('Actualizando estado de conexión:', { status, message });
        
        // Primero removemos todas las clases
        statusLight.removeClass('connected disconnected connecting');
        statusText.removeClass('connected disconnected connecting');
        
        let displayMessage = '';
        switch (status) {
            case 'connecting':
                displayMessage = message || 'Conectando...';
                statusText.text(displayMessage)
                         .addClass('connecting');
                statusLight.addClass('connecting')
                          .css('background-color', '#f0ad4e');
                break;
            case 'connected':
                displayMessage = message || 'Conectado';
                statusText.text(displayMessage)
                         .addClass('connected');
                statusLight.addClass('connected')
                          .css('background-color', '#5cb85c');
                break;
            case 'disconnected':
                displayMessage = message || 'Sin conexión';
                statusText.text(displayMessage)
                         .addClass('disconnected');
                statusLight.addClass('disconnected')
                          .css('background-color', '#d9534f');
                break;
        }
        
        if (DEBUG_MODE) {
            debug('Estado de conexión:', {
                status: status,
                message: displayMessage
            });
        }
    }

    // Función para verificar la conexión con el servidor de mediciones (con cache)
    async function checkConnection() {
        const now = Date.now();
        
        // Usar cache si está disponible y no ha expirado
        if (connectionCache.lastCheck && 
            (now - connectionCache.lastCheck) < connectionCache.cacheDuration) {
            debug('Usando conexión desde cache');
            updateConnectionStatus(connectionCache.isConnected ? 'connected' : 'disconnected');
            return;
        }
        
        debug('Verificando conexión:', MEASUREMENT_SERVER.host);
        updateConnectionStatus('connecting');
        
        // PREVENIR CONEXIONES EXTERNAS - Solo permitir localhost y IPs privadas
        const url = `${MEASUREMENT_SERVER.host}${MEASUREMENT_SERVER.endpoints.ip}`;
        
        try {
            const urlObj = new URL(url);
            const hostname = urlObj.hostname;
            
            // Bloquear conexiones externas
            if (!isLocalOrPrivateIP(hostname)) {
                throw new Error('Conexiones externas no permitidas');
            }
            
            debug('URL local permitida:', url);
            
            const response = await fetch(url);
            
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            
            const data = await response.json();
            
            // Verificar que la respuesta contiene una IP
            if (data && data.ip) {
                connectionCache.isConnected = true;
                connectionCache.lastCheck = now;
                updateConnectionStatus('connected');
            } else {
                connectionCache.isConnected = false;
                connectionCache.lastCheck = now;
                updateConnectionStatus('disconnected', 'Arduino no responde correctamente');
                throw new Error('Respuesta del Arduino no contiene IP');
            }
            
        } catch (error) {
            debugError('Error de conexión:', {
                message: error.message,
                url: url
            });
            connectionCache.isConnected = false;
            connectionCache.lastCheck = now;
            updateConnectionStatus('disconnected', error.message);
            throw error;
        }
    }
    
    // Función para verificar si una IP es local o privada
    function isLocalOrPrivateIP(hostname) {
        // Si las conexiones externas están deshabilitadas, solo permitir localhost
        if (!ALLOW_EXTERNAL_CONNECTIONS) {
            return hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '::1';
        }
        
        // Permitir localhost
        if (hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '::1') {
            return true;
        }
        
        // Permitir IPs privadas solo si las conexiones externas están habilitadas
        const privateRanges = [
            /^10\./,                    // 10.0.0.0/8
            /^172\.(1[6-9]|2[0-9]|3[0-1])\./,  // 172.16.0.0/12
            /^192\.168\./               // 192.168.0.0/16
        ];
        
        return privateRanges.some(range => range.test(hostname));
    }

    // Función para crear el editor de IP del servidor
    function createIpEditor() {
        const editor = $(`
            <div class="pdm-ip-editor">
                <div class="pdm-ip-suggestions"></div>
            </div>
        `);
        
        $('.pdm-connection-indicator').append(editor);
    }

    // Inicializar la funcionalidad del indicador de conexión
    function initConnectionIndicator() {
        createIpEditor();
        
        // Mostrar IP al hacer click en la luz
        $('.pdm-status-light').on('click', function(e) {
            e.stopPropagation();
            const $ipInfo = $('.pdm-ip-info');
            $ipInfo.toggle();
            
            // Ocultar el editor si está visible
            $('.pdm-ip-editor').removeClass('active')
            $('.pdm-current-ip').val(MEASUREMENT_SERVER.host);

        });
        
        // Mostrar editor de IP
        $('.pdm-edit-ip').on('click', function(e) {
            e.stopPropagation();
            const $editor = $('.pdm-ip-editor');
            const $suggestions = $('.pdm-ip-suggestions');
            
            $suggestions.html('<div class="pdm-loading">Cargando...</div>');
            $editor.show();
            
            // Solicitar IPs disponibles
            $.ajax({
                url: pdm_ajax.ajax_url,
                type: 'POST',
                data: {
                    action: 'pdm_get_ips',
                    nonce: pdm_ajax.nonce
                },
                success: function(response) {
                    if (response.success) {
                        displayIpSuggestions(response.data);
                    } else {
                        $suggestions.html('<div class="pdm-error">Error al cargar IPs disponibles</div>');
                    }
                },
                error: function() {
                    $suggestions.html('<div class="pdm-error">Error de conexión</div>');
                }
            });
        });
        
        // Guardar IP
        $('.pdm-save-ip').on('click', function() {
            const $ipInfo = $('.pdm-ip-info');
            const newIp = $('.pdm-ip-input').val().trim();
            
            if (newIp) {
                MEASUREMENT_SERVER.host = newIp;
                debug('IP actualizada a:', newIp);
                $('.pdm-current-ip').text(newIp);
                $ipInfo.removeClass('editing');
                
                // Reiniciar verificación de conexión
                clearInterval(connectionCheckInterval);
                checkConnection();
                startConnectionCheck();
            }
        });
        
        // Cancelar al presionar Escape
        $('.pdm-ip-input').on('keydown', function(e) {
            if (e.key === 'Escape') {
                $('.pdm-ip-info').removeClass('editing');
            } else if (e.key === 'Enter') {
                $('.pdm-save-ip').click();
            }
        });
        
        // Cerrar al hacer clic fuera
        $(document).on('click', function(e) {
            if (!$(e.target).closest('.pdm-ip-info').length) {
                $('.pdm-ip-info').removeClass('editing');
                $('.pdm-save-ip').hide();
                $('.pdm-cancel-ip').hide();
                $('.pdm-ip-editor').hide();
            }
        });
    }

    // Función para iniciar la verificación periódica
    function startConnectionCheck() {
        checkConnection(); // Verificación inicial
        
        // Verificación cada 5 minutos para reducir carga del servidor
        connectionCheckInterval = setInterval(checkConnection, 300000);
    }

    // Escuchar eventos de teclado en todo el documento
    $(document).on('keypress', function(e) {
        const currentTime = new Date().getTime();
        
        // Si el tiempo entre teclas es muy corto, probablemente sea un scanner
        if (currentTime - lastKeyTime <= BARCODE_DELAY) {
            isScanning = true; // Marcamos que estamos en proceso de escaneo
            // No agregar el Enter al buffer
            if (e.which !== 13) {
                barcodeBuffer += e.key;
            }
        } else {
            barcodeBuffer = '';
            isScanning = false; // No es entrada de scanner
            if (e.which !== 13) {
                barcodeBuffer += e.key;
            }
        }
        
        lastKeyTime = currentTime;

        // Si detectamos un enter y tenemos datos en el buffer
        if (e.which === 13 && barcodeBuffer.length > 0) {
            // Si hay una medición en curso, detenerla
            if (isMeasuring) {
                $('.stop-measure-btn:visible').click();
                currentMeasurement = null;
            }
            
            searchProducts(barcodeBuffer, true);
            barcodeInput.val(barcodeBuffer);
            barcodeBuffer = '';
            e.preventDefault();
            
            // Limpiar el flag de escaneo después de un breve delay
            setTimeout(() => {
                isScanning = false;
            }, 100);
        }
    });

    function searchProducts(search, isScanner = false) {
        debug('Iniciando búsqueda:', { search, isScanner });
        spinner.show();
        suggestions.hide();
        
        $.ajax({
            url: pdm_ajax.ajax_url,
            type: 'POST',
            data: {
                action: 'pdm_search_product',
                nonce: pdm_ajax.nonce,
                search: search
            },
            success: function(response) {
                debug('Respuesta de búsqueda:', response);
                spinner.hide();
                if (response.success && response.data.length > 0) {
                    if (isScanner) {
                        debug('Producto encontrado por scanner:', response.data[0]);
                        displayProduct(response.data[0]);
                        barcodeInput.val(response.data[0].sku);
                    } else {
                        displaySuggestions(response.data);
                    }
                } else {
                    debug('No se encontraron productos:', { search, isScanner });
                    if (isScanner) {
                        alert('Producto no encontrado');
                        productInfo.hide();
                    } else {
                        suggestions.html('<div class="pdm-suggestion-item">No se encontraron productos</div>').show();
                    }
                }
            },
            error: function(error) {
                debugError('Error en búsqueda:', error);
                spinner.hide();
                alert('Error al buscar productos');
            }
        });
    }

    // Mantener la búsqueda manual en el input
    barcodeInput.on('keyup', function(e) {
        const search = $(this).val();
        
        // Si no es una entrada de scanner, realizar búsqueda normal
        if (e.which !== 13) {
            clearTimeout(window.searchTimeout);
            window.searchTimeout = setTimeout(() => {
                searchProducts(search, false);
            }, 300);
        }
    });
    
    function displaySuggestions(products) {
        suggestions.empty();
        
        products.forEach(product => {
            const item = $(`
                <div class="pdm-suggestion-item" data-product='${JSON.stringify(product)}'>
                    <img src="${product.image || ''}" alt="${product.title}">
                    <div class="pdm-suggestion-info">
                        <div class="pdm-suggestion-title">${product.title}</div>
                        <div class="pdm-suggestion-meta">${product.meta}</div>
                    </div>
                </div>
            `);
            
            suggestions.append(item);
        });
        
        suggestions.show();
    }
    
    function selectFirstSuggestion() {
        const firstItem = suggestions.find('.pdm-suggestion-item').first();
        if (firstItem.length) {
            firstItem.click();
        }
    }
    
    $(document).on('click', '.pdm-suggestion-item', function() {
        const product = $(this).data('product');
        debug('Producto seleccionado de sugerencias:', product);
        if (product) {
            displayProduct(product);
            suggestions.hide();
            barcodeInput.val(product.sku);
        }
    });
    
    // Cerrar sugerencias al hacer clic fuera
    $(document).on('click', function(e) {
        if (!$(e.target).closest('.pdm-search-section').length) {
            suggestions.hide();
        }
    });
    
    function displayProduct(product) {
        debug('Mostrando producto:', product);
        $('#pdm-product-image').attr('src', product.image);
        $('#pdm-product-title').text(product.title);
        $('#pdm-product-sku').text(product.sku)
            .data('product-id', product.id);
        $('#pdm-weight').val(product.weight);
        $('#pdm-length').val(product.length);
        $('#pdm-width').val(product.width);
        $('#pdm-height').val(product.height);
        $('#pdm-price').text(product.price);
        
        debug('Datos guardados en elementos:', {
            sku: $('#pdm-product-sku').text(),
            productId: $('#pdm-product-sku').data('product-id'),
            price: $('#pdm-price').text(),
            weight: $('#pdm-weight').val(),
            dimensions: {
                length: $('#pdm-length').val(),
                width: $('#pdm-width').val(),
                height: $('#pdm-height').val()
            }
        });
        
        // Resetear el estado de medición y limpiar cache
        currentField = null;
        isMeasuring = false;
        measurementInterval = null;
        
        // Limpiar cache de mediciones al cambiar de producto
        measurementCache.weight = { value: null, timestamp: 0 };
        measurementCache.dimension = { value: null, timestamp: 0 };
        
        updateFieldVisuals();
        
        productInfo.show();
    }

    // Manejador para guardar los cambios en el producto
    $('.pdm-save-all').on('click', function() {
        const $sku = $('#pdm-product-sku');
        debug('Estado actual del elemento SKU:', {
            element: $sku,
            text: $sku.text(),
            dataProductId: $sku.data('product-id')
        });

        const productId = $sku.data('product-id');
        debug('ID del producto a guardar:', productId);

        const data = {
            action: 'pdm_save_dimensions',
            nonce: pdm_ajax.nonce,
            product_id: productId,
            weight: $('#pdm-weight').val(),
            length: $('#pdm-length').val(),
            width: $('#pdm-width').val(),
            height: $('#pdm-height').val()
        };
        
        debug('Datos a enviar:', data);
        
        // Mostrar indicador de carga
        $(this).addClass('loading').prop('disabled', true);
        
        $.ajax({
            url: pdm_ajax.ajax_url,
            type: 'POST',
            data: data,
            success: function(response) {
                debug('Respuesta del servidor:', response);
                if (response.success) {
                    alert('Datos guardados correctamente');
                } else {
                    debugError('Error en respuesta:', response);
                    alert('Error al guardar los datos: ' + response.data);
                }
            },
            error: function(xhr, status, error) {
                debugError('Error en la petición:', {
                    xhr: xhr,
                    status: status,
                    error: error
                });
                alert('Error al comunicarse con el servidor');
            },
            complete: function() {
                // Quitar indicador de carga
                $('.pdm-save-all').removeClass('loading').prop('disabled', false);
            }
        });
    });

    // Función para obtener el peso de la balanza (con cache y validación)
    async function getWeight() {
        const now = Date.now();
        
        // Usar cache si está disponible y no ha expirado
        if (measurementCache.weight.value !== null && 
            (now - measurementCache.weight.timestamp) < measurementCache.cacheDuration) {
            debug('Usando peso desde cache:', measurementCache.weight.value);
            return measurementCache.weight.value;
        }
        
        const weightUrl = `${MEASUREMENT_SERVER.host}${MEASUREMENT_SERVER.endpoints.weight}`;
        debug('Iniciando petición de peso a', weightUrl);
        
        try {
            const urlObj = new URL(weightUrl);
            const hostname = urlObj.hostname;
            
            // Bloquear conexiones externas
            if (!isLocalOrPrivateIP(hostname)) {
                throw new Error('Conexiones externas no permitidas para mediciones');
            }
            
            const response = await fetch(weightUrl);
            debug('Respuesta del servidor de peso:', response);
            const data = await response.json();
            debug('Datos de peso recibidos:', data);
            
            // Extraer el valor y formatearlo a 2 decimales
            const weight = Number(data.peso_kg || data.weight || data.value).toFixed(2);
            debug('Peso formateado:', weight);
            
            // Actualizar cache
            measurementCache.weight.value = weight;
            measurementCache.weight.timestamp = now;
            
            return weight;
        } catch (error) {
            debugError('Error detallado al obtener el peso:', {
                message: error.message,
                error: error
            });
            throw error;
        }
    }

    // Función para obtener dimensiones (con cache y validación)
    async function getDimension() {
        const now = Date.now();
        
        // Usar cache si está disponible y no ha expirado
        if (measurementCache.dimension.value !== null && 
            (now - measurementCache.dimension.timestamp) < measurementCache.cacheDuration) {
            debug('Usando dimensión desde cache:', measurementCache.dimension.value);
            return measurementCache.dimension.value;
        }
        
        const dimensionUrl = `${MEASUREMENT_SERVER.host}${MEASUREMENT_SERVER.endpoints.dimension}`;
        debug('Iniciando petición de dimensión a', dimensionUrl);
        
        try {
            const urlObj = new URL(dimensionUrl);
            const hostname = urlObj.hostname;
            
            // Bloquear conexiones externas
            if (!isLocalOrPrivateIP(hostname)) {
                throw new Error('Conexiones externas no permitidas para mediciones');
            }
            
            const response = await fetch(dimensionUrl);
            debug('Respuesta del servidor de dimensiones:', response);
            const data = await response.json();
            debug('Datos de dimensión recibidos:', data);
            
            // Extraer el valor y formatearlo a 2 decimales
            const dimension = Number(data.dimension_cm).toFixed(2);
            debug('Dimensión formateada:', dimension);
            
            // Actualizar cache
            measurementCache.dimension.value = dimension;
            measurementCache.dimension.timestamp = now;
            
            return dimension;
        } catch (error) {
            debugError('Error detallado al obtener la dimensión:', {
                message: error.message,
                error: error
            });
            throw error;
        }
    }

    // Variables para controlar las mediciones continuas
    let measurementInterval = null;
    const MEASUREMENT_DELAY = 2000; // 2 segundos entre mediciones para reducir carga
    
    // Cache para conexiones y mediciones
    let connectionCache = {
        lastCheck: 0,
        isConnected: false,
        cacheDuration: 300000 // 5 minutos
    };
    
    let measurementCache = {
        weight: { value: null, timestamp: 0 },
        dimension: { value: null, timestamp: 0 },
        cacheDuration: 5000 // 5 segundos
    };

    // Función modificada para obtener el peso continuamente
    async function startContinuousWeight($input, $measureBtn, $stopBtn) {
        try {
            const weight = await getWeight();
            if (weight && !isNaN(weight)) {
                $input.val(weight);
                debug('Peso actualizado en input:', weight);
            } else {
                debug('Peso inválido recibido:', weight);
            }
            
            // Programar la siguiente medición si el intervalo sigue activo
            if (measurementInterval) {
                setTimeout(() => startContinuousWeight($input, $measureBtn, $stopBtn), MEASUREMENT_DELAY);
            }
        } catch (error) {
            debugError('Error en medición continua de peso:', error);
            stopMeasurement($measureBtn, $stopBtn);
            alert(`Error al obtener la medición: ${error.message}`);
        }
    }

    // Función modificada para obtener dimensiones continuamente
    async function startContinuousDimension($input, $measureBtn, $stopBtn) {
        try {
            const dimension = await getDimension();
            if (dimension && !isNaN(dimension)) {
                $input.val(dimension);
                debug('Dimensión actualizada en input:', dimension);
            } else {
                debug('Dimensión inválida recibida:', dimension);
            }
            
            // Programar la siguiente medición si el intervalo sigue activo
            if (measurementInterval) {
                // Usar una función de flecha directamente
                setTimeout(() => startContinuousDimension($input, $measureBtn, $stopBtn), MEASUREMENT_DELAY);
            }
        } catch (error) {
            debugError('Error en medición continua de dimensión:', error);
            stopMeasurement($measureBtn, $stopBtn);
            alert(`Error al obtener la medición: ${error.message}`);
        }
    }

    // Función para detener las mediciones
    function stopMeasurement($measureBtn, $stopBtn) {
        measurementInterval = null;
        $measureBtn.removeClass('loading');
        $stopBtn.hide();
        $measureBtn.show();
        isMeasuring = false;
        
        // Si esta es la última medición, marcar el ciclo como completado
        if (currentMeasurement === 'height') {
            currentMeasurement = null;
            cycleCompleted = true;
        }
    }

    // Modificar el manejador de clicks en los botones de medición
    $('.measure-btn').on('click', function() {
        const $button = $(this);
        const $input = $button.closest('.pdm-input-group').find('input');
        
        const $stopBtn = $button.nextAll('.stop-measure-btn').first();
        const measureType = $button.data('type');
        debug('Iniciando medición para:', measureType);
        
        $button.hide();
        $stopBtn.show();
        isMeasuring = true;
        
        // Iniciar medición continua
        measurementInterval = true;
        $button.addClass('loading');
        
        if (measureType === 'weight') {
            startContinuousWeight($input, $button, $stopBtn);
        } else {
            startContinuousDimension($input, $button, $stopBtn);
        }
    });

    // Manejador para el botón de detener
    $('.stop-measure-btn').on('click', function() {
        const $stopBtn = $(this);
        const $measureBtn = $stopBtn.prevAll('.measure-btn').first();
        stopMeasurement($measureBtn, $stopBtn);
    });

    // Agregar tooltips a los botones de medición
    $('.measure-btn').each(function() {
        const type = $(this).data('type');
        const title = type === 'weight' ? 'Obtener peso de la balanza' : `Obtener ${type} del detector`;
        $(this).attr('title', title);
    });

    // Función para iniciar la siguiente medición en la secuencia
    function startNextMeasurement() {
        // Si el ciclo está completo, no hacer nada
        if (cycleCompleted) {
            debug('Ciclo completado, no se pueden iniciar más mediciones');
            return;
        }

        // Si estamos midiendo, detener la medición actual y avanzar
        if (isMeasuring) {
            $('.stop-measure-btn:visible').click();
            
            // Si acabamos de detener la última medición, no continuar
            if (cycleCompleted) {
                return;
            }
            
            // Avanzar al siguiente en la secuencia
            const currentIndex = measurementSequence.indexOf(currentMeasurement);
            currentMeasurement = measurementSequence[currentIndex + 1];
            return;
        }

        // Si no estamos midiendo, iniciar la medición actual o la primera
        if (!currentMeasurement) {
            currentMeasurement = 'weight';
        }

        // Encontrar el botón correspondiente y simular el click
        const $measureBtn = $(`.measure-btn[data-type="${currentMeasurement}"]`);
        $measureBtn.click();
        isMeasuring = true;
    }

    // Modificar el manejador de teclas para todo el documento
    $(document).on('keydown', function(e) {
        // Ignorar Enter si viene del scanner
        if (isScanning) return;

        // Solo procesar si hay un producto seleccionado
        if (!productInfo.is(':visible')) return;

        // Ignorar eventos si el foco está en un campo de texto no relacionado
        if (e.target.tagName === 'INPUT' && !$(e.target).closest('.pdm-dimensions-form').length) return;

        switch (e.key) {
            case ' ': // Espacio
                e.preventDefault();
                if (!currentField) {
                    currentField = 'weight';
                    updateFieldVisuals();
                    return;
                }
                
                // Toggle medición del campo actual
                const $currentMeasureBtn = $(`.measure-btn[data-type="${currentField}"]`);
                const $currentStopBtn = $currentMeasureBtn.nextAll('.stop-measure-btn').first();
                
                if (isMeasuring) {
                    $currentStopBtn.click();
                } else {
                    $currentMeasureBtn.click();
                }
                break;
                
            case 'ArrowUp':
                e.preventDefault();
                switchField('up');
                break;
                
            case 'ArrowDown':
                e.preventDefault();
                switchField('down');
                break;
                
            case 'Enter':
                e.preventDefault();
                // Si hay una medición en curso, detenerla
                if (isMeasuring) {
                    $('.stop-measure-btn:visible').click();
                }
                // Simular click en el botón de guardar
                $('.pdm-save-all').click();
                break;
        }
    });

    // Modificar la función switchField para que sea más robusta
    function switchField(direction) {
        const fields = ['weight', 'length', 'width', 'height'];
        
        // Si no hay campo activo, empezar con weight
        if (!currentField) {
            currentField = 'weight';
        } else {
            // Encontrar el índice actual
            const currentIndex = fields.indexOf(currentField);
            let newIndex;
            
            // Calcular nuevo índice basado en la dirección
            if (direction === 'up') {
                newIndex = currentIndex <= 0 ? fields.length - 1 : currentIndex - 1;
            } else {
                newIndex = currentIndex >= fields.length - 1 ? 0 : currentIndex + 1;
            }
            
            // Detener medición actual si está activa
            if (isMeasuring) {
                $('.stop-measure-btn:visible').click();
            }
            
            // Actualizar campo actual
            currentField = fields[newIndex];
        }
        
        // Enfocar el nuevo campo y actualizar visuales
        $(`#pdm-${currentField}`).focus();
        updateFieldVisuals();
        debug('Campo activo:', currentField);
    }

    // Modificar la función updateFieldVisuals para que sea más clara
    function updateFieldVisuals() {
        // Remover resaltado de todos los campos
        $('.pdm-form-row').removeClass('active-field');
        
        // Agregar resaltado al campo actual si existe
        if (currentField) {
            $(`#pdm-${currentField}`).closest('.pdm-form-row').addClass('active-field');
            debug('Actualizando visuales para campo:', currentField);
        }
    }

    // Agregar manejador de click para los inputs
    $('.pdm-dimensions-form input').on('click', function() {
        const fieldId = $(this).attr('id').replace('pdm-', '');
        currentField = fieldId;
        updateFieldVisuals();
    });

    // Función para mostrar las sugerencias de IP
    function displayIpSuggestions(ips) {
        const $suggestions = $('.pdm-ip-suggestions');
        $suggestions.empty();
        
        ips.forEach(ip => {
            const item = $(`
                <div class="pdm-ip-suggestion-item" data-ip="${ip.ip}">
                    <div class="pdm-ip-suggestion-info">
                        <div class="pdm-ip-suggestion-name">${ip.name}</div>
                        <div class="pdm-ip-suggestion-address">${ip.ip}</div>
                    </div>
                </div>
            `);
            
            $suggestions.append(item);
        });
    }

    // Manejar la selección de IP
    $(document).on('click', '.pdm-ip-suggestion-item', function() {
        const newIp = $(this).data('ip');
        const ipName = $(this).find('.pdm-ip-suggestion-name').text();
        
        if (newIp) {
            MEASUREMENT_SERVER.host = newIp;
            debug('IP actualizada:', newIp);
            $('.pdm-current-ip').text(ipName);
            $('.pdm-ip-editor').hide();
            
            // Reiniciar verificación de conexión
            clearInterval(connectionCheckInterval);
            checkConnection();
            startConnectionCheck();
        }
    });

    // Función para obtener la IP inicial
    async function initializeHost() {
        updateConnectionStatus('disconnected', 'Iniciando...'); // Estado inicial
        
        try {
            const response = await $.ajax({
                url: pdm_ajax.ajax_url,
                type: 'POST',
                data: {
                    action: 'pdm_get_ips',
                    nonce: pdm_ajax.nonce
                }
            });

            if (response.success && response.data.length > 0) {
                const firstIp = response.data[0];
                MEASUREMENT_SERVER.host = firstIp.ip;
                $('.pdm-current-ip').text(firstIp.name);
                
                debug('Host inicial:', firstIp.ip);
                
                // Iniciar la verificación de conexión después de establecer el host
                initConnectionIndicator();
                updateConnectionStatus('connecting', 'Verificando conexión...'); // Mostrar que está intentando conectar
                startConnectionCheck();
            } else {
                debugError('No hay IPs disponibles');
                updateConnectionStatus('disconnected', 'No hay IPs disponibles');
            }
        } catch (error) {
            debugError('Error al obtener IPs iniciales:', error);
            updateConnectionStatus('disconnected', 'Error al obtener IPs');
        }
    }

    initializeHost();
}); 