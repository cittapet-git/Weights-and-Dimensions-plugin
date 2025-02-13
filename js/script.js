const DEBUG_MODE = true;
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
        host: 'https://mesapesoymedida.cittapet.com',
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
        
        switch (status) {
            case 'connecting':
                statusText.text('Conectando...')
                         .addClass('connecting');
                statusLight.addClass('connecting')
                          .css('background-color', '#f0ad4e');
                break;
            case 'connected':
                statusText.text('Conectado')
                         .addClass('connected');
                statusLight.addClass('connected')
                          .css('background-color', '#5cb85c');
                break;
            case 'disconnected':
                statusText.text('Sin conexión')
                         .addClass('disconnected');
                statusLight.addClass('disconnected')
                          .css('background-color', '#d9534f');
                break;
        }
        
        if (message) {
            debug('Mensaje adicional:', message);
        }
    }

    // Función para verificar la conexión con el servidor de mediciones
    async function checkConnection() {
        const currentIp = MEASUREMENT_SERVER.host;
        
        debug('Iniciando verificación de conexión con:', MEASUREMENT_SERVER.host)
        //+MEASUREMENT_SERVER.endpoints.ip;
        updateConnectionStatus('connecting');
        
        try {
            ;
            
            const response = await fetch(`${MEASUREMENT_SERVER.host}`);
            //{MEASUREMENT_SERVER.endpoints.ip}
            
            debug('Respuesta del servidor:', response)

            if (response.ok) {
                debug('Conexión exitosa al servidor de mediciones');
                updateConnectionStatus('connected');
                
                // Intentar obtener más información del servidor si está disponible
                try {
                    const data = await response.json();
                    debug('Información adicional del servidor:', data);
                } catch (e) {
                    debug('No hay información adicional disponible');
                }
            } else {
                throw new Error(`Error en la respuesta del servidor: ${response.status}`);
            }
        } catch (error) {
            debugError('Error de conexión:', {
                message: error.message,
                error: error
            });
            updateConnectionStatus('disconnected', error.message);
        }
        
        //currentIp.text(MEASUREMENT_SERVER.host);
    }

    // Función para crear el editor de IP del servidor
    function createIpEditor() {
        debug('Creando editor de IP con host:', MEASUREMENT_SERVER.host);
        
        const editor = $(`
            <div class="pdm-ip-editor">
                <input type="text" class="pdm-ip-input" value="${MEASUREMENT_SERVER.host}">
                <button class="button button-primary pdm-save-ip" style='display: none;'>Guardar</button>
                <button class="button pdm-cancel-ip" style='display: none;'>Cancelar</button>
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
            const $ipInfo = $('.pdm-ip-info');
            const $input = $('.pdm-ip-input');
            const $editor = $('.pdm-ip-editor');
            
            debug('Abriendo editor de IP');
            
            // Mostrar el editor
            $editor.show();
            
            // Establecer el valor actual del servidor en el input
            $input.val(MEASUREMENT_SERVER.host);
            debug('Valor establecido en input:', MEASUREMENT_SERVER.host);
            
            // Actualizar clases y mostrar botones
            $ipInfo.addClass('editing');
            $input.focus();
            $('.pdm-save-ip').show();
            $('.pdm-cancel-ip').show();
        });
        
        // Guardar IP
        $('.pdm-save-ip').on('click', function() {
            const $ipInfo = $('.pdm-ip-info');
            const newIp = $('.pdm-ip-input').val().trim();
            
            if (newIp) {
                MEASUREMENT_SERVER.host = newIp;
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
        connectionCheckInterval = setInterval(checkConnection, 30000); // Verificar cada 30 segundos
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
        
        // Resetear el estado de medición
        currentField = null;
        isMeasuring = false;
        measurementInterval = null;
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

    // Función para obtener el peso de la balanza
    async function getWeight() {
        const weightUrl = `${MEASUREMENT_SERVER.host}${MEASUREMENT_SERVER.endpoints.weight}`;
        debug('Iniciando petición de peso a', weightUrl);
        try {
            const response = await fetch(weightUrl);
            debug('Respuesta del servidor de peso:', response);
            const data = await response.json();
            debug('Datos de peso recibidos:', data);
            
            // Extraer el valor y formatearlo a 2 decimales
            // Asumiendo que la respuesta del peso tiene un formato similar
            const weight = Number(data.peso_kg || data.weight || data.value).toFixed(2);
            debug('Peso formateado:', weight);
            return weight;
        } catch (error) {
            debugError('Error detallado al obtener el peso:', {
                message: error.message,
                error: error
            });
            throw error;
        }
    }

    // Función para obtener dimensiones
    async function getDimension() {
        const dimensionUrl = `${MEASUREMENT_SERVER.host}${MEASUREMENT_SERVER.endpoints.dimension}`;
        debug('Iniciando petición de dimensión a', dimensionUrl);
        try {
            const response = await fetch(dimensionUrl);
            debug('Respuesta del servidor de dimensiones:', response);
            const data = await response.json();
            debug('Datos de dimensión recibidos:', data);
            
            // Extraer el valor y formatearlo a 2 decimales
            const dimension = Number(data.dimension_cm).toFixed(2);
            debug('Dimensión formateada:', dimension);
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
    const MEASUREMENT_DELAY = 400; // 250ms entre mediciones

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

    // Inicializar el indicador de conexión
    initConnectionIndicator();
    startConnectionCheck();
}); 