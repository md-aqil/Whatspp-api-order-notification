<?php
/**
 * Plugin Name: WhatsApp Order Notification Connector
 * Description: Sends WooCommerce order notifications via WhatsApp webhooks
 * Version: 2.3
 * Author: Your Name
 */

if (!defined('ABSPATH')) exit;

function wa_connector_menu() {
    add_options_page('WhatsApp Connector', 'WhatsApp Connector', 'manage_options', 'wa-connector', 'wa_connector_page');
}
add_action('admin_menu', 'wa_connector_menu');

function wa_connector_settings() {
    register_setting('wa_connector_group', 'wa_connector_enabled');
    register_setting('wa_connector_group', 'wa_connector_webhook_url', [
        'sanitize_callback' => 'wa_connector_sanitize_webhook_url',
    ]);
    register_setting('wa_connector_group', 'wa_connector_connection_url', [
        'sanitize_callback' => 'wa_connector_sanitize_connection_url',
    ]);
    register_setting('wa_connector_group', 'wa_connector_site_id');
    register_setting('wa_connector_group', 'wa_connector_webhook_secret');
    register_setting('wa_connector_group', 'wa_connector_tables');
}
add_action('admin_init', 'wa_connector_settings');

function wa_connector_sanitize_webhook_url($url) {
    return wa_connector_normalize_webhook_url($url);
}

function wa_connector_sanitize_connection_url($url) {
    return wa_connector_normalize_connection_url($url);
}

function wa_connector_normalize_webhook_url($url) {
    $url = trim((string) $url);

    if ($url === '') {
        return '';
    }

    $parts = wp_parse_url($url);
    if (!$parts || empty($parts['scheme']) || empty($parts['host'])) {
        return esc_url_raw($url);
    }

    $path = isset($parts['path']) ? untrailingslashit($parts['path']) : '';
    $should_force_custom_endpoint = (
        $path === '' ||
        $path === '/dashboard' ||
        $path === '/dashboard/settings' ||
        substr($path, -19) === '/dashboard/settings'
    );

    if ($should_force_custom_endpoint) {
        $normalized = $parts['scheme'] . '://';

        if (!empty($parts['user'])) {
            $normalized .= $parts['user'];
            if (!empty($parts['pass'])) {
                $normalized .= ':' . $parts['pass'];
            }
            $normalized .= '@';
        }

        $normalized .= $parts['host'];

        if (!empty($parts['port'])) {
            $normalized .= ':' . $parts['port'];
        }

        $normalized .= '/api/webhook/custom';

        return esc_url_raw($normalized);
    }

    return esc_url_raw($url);
}

function wa_connector_normalize_connection_url($url) {
    $url = trim((string) $url);

    if ($url === '') {
        return '';
    }

    return esc_url_raw($url);
}

function wa_connector_get_webhook_url() {
    return wa_connector_normalize_webhook_url(get_option('wa_connector_webhook_url'));
}

function wa_connector_get_connection_url() {
    return wa_connector_normalize_connection_url(get_option('wa_connector_connection_url'));
}

function wa_connector_page() {
    $tables = wa_connector_get_tables();
    $saved_tables = get_option('wa_connector_tables', '[]');
    if (empty($saved_tables)) {
        $saved_tables = '[]';
    }
    $tables_json = json_encode($tables);
    $saved_tables_json = $saved_tables;
?>
<div class="wrap">
    <h1>WhatsApp Connector Settings</h1>
    <form method="post" action="options.php">
        <?php settings_fields('wa_connector_group'); ?>
        
        <table class="form-table">
            <tr valign="top">
                <th scope="row">Enable</th>
                <td><input type="checkbox" name="wa_connector_enabled" value="yes" <?php checked(get_option('wa_connector_enabled'), 'yes'); ?> /></td>
            </tr>
            <tr valign="top">
                <th scope="row">Webhook URL</th>
                <td>
                    <input type="text" name="wa_connector_webhook_url" value="<?php echo esc_attr(get_option('wa_connector_webhook_url')); ?>" class="regular-text" placeholder="https://your-tunnel-url/api/webhook/custom" />
                    <p class="description">Use the API endpoint, not the dashboard page. If you paste <code>http://localhost:3000</code> or <code>/dashboard/settings</code>, the plugin will automatically send to <code>/api/webhook/custom</code>.</p>
                </td>
            </tr>
            <tr valign="top">
                <th scope="row">Connection URL</th>
                <td>
                    <input type="text" name="wa_connector_connection_url" value="<?php echo esc_attr(get_option('wa_connector_connection_url')); ?>" class="regular-text" placeholder="Paste the connect link generated in your dashboard" />
                    <p class="description">Paste the WordPress plugin connect link from your dashboard, then use "Connect to Platform" below. This will auto-fill the webhook URL, site ID, and secret.</p>
                </td>
            </tr>
            <tr valign="top">
                <th scope="row">Site ID (for multi-site identification)</th>
                <td><input type="text" name="wa_connector_site_id" value="<?php echo esc_attr(get_option('wa_connector_site_id')); ?>" class="regular-text" placeholder="e.g., my-shop-1" /></td>
            </tr>
            <tr valign="top">
                <th scope="row">Webhook Secret</th>
                <td>
                    <input type="text" readonly value="<?php echo esc_attr(get_option('wa_connector_webhook_secret')); ?>" class="regular-text" />
                    <p class="description">Assigned automatically after a successful connection handshake.</p>
                </td>
            </tr>
        </table>
        
        <h2>Custom Table Mappings</h2>
        <p>Map custom database tables to webhook fields for order notifications.</p>
        <button type="button" class="button" onclick="showAddModal()">+ Add Table Mapping</button>
        
        <div id="wa-tables-list" style="margin-top: 15px;">
            <?php
            $saved = json_decode($saved_tables, true);
            if ($saved && is_array($saved)) {
                foreach ($saved as $index => $table) {
                    echo '<div class="wa-table-item" style="background:#f9f9f9;padding:10px;margin:5px 0;border:1px solid #ddd;position:relative;">';
                    echo '<strong>Table:</strong> ' . esc_html($table['table']) . '<br>';
                    echo '<strong>ID Column:</strong> ' . esc_html($table['id_column']) . ' | ';
                    echo '<strong>Name:</strong> ' . esc_html($table['map_name']) . ' | ';
                    echo '<strong>Phone:</strong> ' . esc_html($table['map_phone']) . ' | ';
                    echo '<strong>Order:</strong> ' . esc_html($table['map_order']) . ' | ';
                    echo '<strong>Total:</strong> ' . esc_html($table['map_total']);
                    echo ' <span class="delete-btn" onclick="deleteTable(' . $index . ')" style="color:red;cursor:pointer;margin-left:10px;">[Delete]</span>';
                    echo '</div>';
                }
            }
            ?>
        </div>
        
        <?php submit_button(); ?>
    </form>

    <hr>
    <h2>Connect This Site</h2>
    <p>Use the connect link from your dashboard to configure this plugin automatically.</p>
    <form method="post" action="">
        <?php wp_nonce_field('wa_connect_platform', 'wa_connect_nonce'); ?>
        <p>
            <label for="wa-connect-connection-url"><strong>Connection URL</strong></label><br>
            <input id="wa-connect-connection-url" type="text" name="wa_connect_connection_url" value="<?php echo esc_attr(get_option('wa_connector_connection_url')); ?>" class="regular-text" placeholder="Paste the connect link generated in your dashboard" />
        </p>
        <input type="submit" name="wa_connect_site" class="button button-primary" value="Connect to Platform">
    </form>

    <hr>
    <h2>Test Connection</h2>
    <p>Send a test notification to your dashboard to verify the webhook connection.</p>
    <form method="post" action="">
        <?php wp_nonce_field('wa_test_webhook', 'wa_test_nonce'); ?>
        <input type="submit" name="wa_send_test" class="button button-secondary" value="Send Test Webhook">
    </form>
    
    <?php
    if (isset($_POST['wa_send_test']) && check_admin_referer('wa_test_webhook', 'wa_test_nonce')) {
        $test_data = [
            'event' => 'woocommerce.order_created',
            'order_id' => 'TEST-' . time(),
            'order_number' => 'TEST-' . time(),
            'customer_name' => 'Demo User',
            'customer_phone' => '1234567890',
            'customer_email' => 'demo@example.com',
            'order_total' => '100.00',
            'order_status' => 'processing',
            'site_name' => get_bloginfo('name'),
            'site_url' => get_site_url(),
            'is_test' => true
        ];
        $success = wa_connector_send_webhook($test_data);
        if ($success) {
            echo '<div class="updated"><p>✅ Test webhook sent! Check your dashboard activity log.</p></div>';
        } else {
            echo '<div class="error"><p>❌ Failed to send. Check if your Webhook URL is correct and the plugin is enabled.</p></div>';
        }
    }

    if (isset($_POST['wa_connect_site']) && check_admin_referer('wa_connect_platform', 'wa_connect_nonce')) {
        $connect_result = wa_connector_connect_platform(isset($_POST['wa_connect_connection_url']) ? wp_unslash($_POST['wa_connect_connection_url']) : '');
        if (is_wp_error($connect_result)) {
            echo '<div class="error"><p>❌ ' . esc_html($connect_result->get_error_message()) . '</p></div>';
        } else {
            echo '<div class="updated"><p>✅ Connected successfully. Webhook URL, site ID, and secret were synced from the platform.</p></div>';
        }
    }
    ?>
</div>

<div id="wa-add-modal" style="display:none;position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.5);z-index:9999;">
    <div style="background:white;padding:20px;margin:100px auto;max-width:500px;border-radius:5px;">
        <h3>Add Table Mapping</h3>
        <p>
            <label>Table:</label><br>
            <select id="wa-table-select" onchange="loadTableColumns(this.value)" style="width:100%;">
                <option value="">Select a table...</option>
                <?php foreach ($tables as $table): ?>
                    <option value="<?php echo esc_attr($table); ?>"><?php echo esc_html($table); ?></option>
                <?php endforeach; ?>
            </select>
        </p>
        <p>
            <label>ID Column:</label><br>
            <select id="wa-id-column" style="width:100%;"><option value="">Select table first...</option></select>
        </p>
        <p>
            <label>Name Column:</label><br>
            <select id="wa-map-name" style="width:100%;"><option value="">Select table first...</option></select>
        </p>
        <p>
            <label>Phone Column:</label><br>
            <select id="wa-map-phone" style="width:100%;"><option value="">Select table first...</option></select>
        </p>
        <p>
            <label>Order Number Column:</label><br>
            <select id="wa-map-order" style="width:100%;"><option value="">Select table first...</option></select>
        </p>
        <p>
            <label>Total Amount Column:</label><br>
            <select id="wa-map-total" style="width:100%;"><option value="">Select table first...</option></select>
        </p>
        <button type="button" class="button button-primary" onclick="addTable()">Save Table</button>
        <button type="button" class="button" onclick="closeModal()">Cancel</button>
    </div>
</div>

<div id="wa-loading" style="display:none;text-align:center;padding:20px;">Loading...</div>

<script>
var currentTables = <?php echo $saved_tables_json; ?>;

function showAddModal() {
    document.getElementById('wa-add-modal').style.display = 'block';
}

function closeModal() {
    document.getElementById('wa-add-modal').style.display = 'none';
}

function loadTableColumns(tableName) {
    if (!tableName) return;
    
    document.getElementById('wa-loading').style.display = 'block';
    
    jQuery.post('<?php echo admin_url('admin-ajax.php'); ?>', {
        action: 'wa_connector_get_table_columns',
        table: tableName,
        nonce: '<?php echo wp_create_nonce('wa_connector_nonce'); ?>'
    }, function(res) {
        document.getElementById('wa-loading').style.display = 'none';
        if (res.success) {
            var cols = res.data;
            var options = '<option value="">-- Select --</option>';
            cols.forEach(function(c) {
                options += '<option value="' + c + '">' + c + '</option>';
            });
            
            document.getElementById('wa-id-column').innerHTML = options;
            document.getElementById('wa-map-name').innerHTML = options;
            document.getElementById('wa-map-phone').innerHTML = options;
            document.getElementById('wa-map-order').innerHTML = options;
            document.getElementById('wa-map-total').innerHTML = options;
        }
    });
}

function addTable() {
    var tableName = document.getElementById('wa-table-select').value;
    var idCol = document.getElementById('wa-id-column').value;
    var nameCol = document.getElementById('wa-map-name').value;
    var phoneCol = document.getElementById('wa-map-phone').value;
    var orderCol = document.getElementById('wa-map-order').value;
    var totalCol = document.getElementById('wa-map-total').value;
    
    if (!tableName || !idCol) {
        alert('Please select at least table and ID column');
        return;
    }
    
    currentTables.push({
        table: tableName,
        id_column: idCol,
        map_name: nameCol,
        map_phone: phoneCol,
        map_order: orderCol,
        map_total: totalCol
    });
    
    jQuery.post('<?php echo admin_url('admin-ajax.php'); ?>', {
        action: 'wa_connector_save_tables',
        tables: JSON.stringify(currentTables),
        nonce: '<?php echo wp_create_nonce('wa_connector_nonce'); ?>'
    }, function(res) {
        if (res.success) {
            location.reload();
        }
    });
}

function deleteTable(index) {
    if (!confirm('Delete this mapping?')) return;
    currentTables.splice(index, 1);
    jQuery.post('<?php echo admin_url('admin-ajax.php'); ?>', {
        action: 'wa_connector_save_tables',
        tables: JSON.stringify(currentTables),
        nonce: '<?php echo wp_create_nonce('wa_connector_nonce'); ?>'
    }, function(res) {
        if (res.success) {
            location.reload();
        }
    });
}
</script>

<?php
}

function wa_connector_get_tables() {
    global $wpdb;
    $tables = $wpdb->get_results("SHOW TABLES", ARRAY_N);
    return array_map(function($t) { return $t[0]; }, $tables);
}

add_action('wp_ajax_wa_connector_get_table_columns', function() {
    check_ajax_referer('wa_connector_nonce', 'nonce');
    global $wpdb;
    $table = sanitize_text_field($_POST['table']);
    $columns = $wpdb->get_results("DESCRIBE `$table`", ARRAY_N);
    wp_send_json_success(array_map(function($c) { return $c[0]; }, $columns));
});

add_action('wp_ajax_wa_connector_save_tables', function() {
    check_ajax_referer('wa_connector_nonce', 'nonce');
    $tables = json_decode(stripslashes($_POST['tables']), true);
    update_option('wa_connector_tables', json_encode($tables));
    wp_send_json_success();
});

add_action('wp_ajax_wa_get_config', 'wa_connector_get_config_api');
add_action('wp_ajax_nopriv_wa_get_config', 'wa_connector_get_config_api');

function wa_connector_get_config_api() {
    $enabled = get_option('wa_connector_enabled') === 'yes';
    $site_url = get_site_url();
    
    // Check if WooCommerce is actually active on the site
    $woo_active = class_exists('WooCommerce');
    
    // Default WooCommerce triggers supported by the plugin
    $triggers = [];
    
    if ($woo_active) {
        $triggers = [
            [
                'name' => 'woocommerce.order_created',
                'label' => 'Order Created (New)',
                'value' => 'woocommerce.order_created',
                'description' => 'When a new order is received'
            ],
            [
                'name' => 'woocommerce.order_processing',
                'label' => 'Order Processing',
                'value' => 'woocommerce.order_processing',
                'description' => 'When order status changes to processing'
            ],
            [
                'name' => 'woocommerce.order_completed',
                'label' => 'Order Completed',
                'value' => 'woocommerce.order_completed',
                'description' => 'When order status changes to completed'
            ],
            [
                'name' => 'woocommerce.order_cancelled',
                'label' => 'Order Cancelled',
                'value' => 'woocommerce.order_cancelled',
                'description' => 'When an order is cancelled'
            ],
            [
                'name' => 'woocommerce.order_failed',
                'label' => 'Order Failed',
                'value' => 'woocommerce.order_failed',
                'description' => 'When an order payment fails'
            ]
        ];
    }
    
    // Get custom mapped tables
    $saved_tables = get_option('wa_connector_tables', '[]');
    $tables_array = json_decode($saved_tables, true);
    if (!is_array($tables_array)) {
        $tables_array = [];
    }
    
    $formatted_tables = array_map(function($t) {
        return [
            'name' => $t['table'],
            'label' => 'Table: ' . $t['table']
        ];
    }, $tables_array);
    
    $config = [
        'wordpress_url' => $site_url,
        'woocommerce' => [
            'enabled' => $enabled && $woo_active,
            'triggers' => $triggers
        ],
        'custom_tables' => [
            'enabled' => count($tables_array) > 0,
            'tables' => $formatted_tables
        ]
    ];
    
    // Send CORS headers in case it's requested directly from browser
    header("Access-Control-Allow-Origin: *");
    header("Content-Type: application/json; charset=UTF-8");
    echo json_encode($config);
    wp_die();
}

// Hook into WooCommerce order statuses
add_action('woocommerce_new_order', 'wa_connector_send_order_notification');
add_action('woocommerce_order_status_processing', 'wa_connector_send_order_notification');
add_action('woocommerce_order_status_completed', 'wa_connector_send_order_notification');
add_action('woocommerce_order_status_cancelled', 'wa_connector_send_order_notification');
add_action('woocommerce_order_status_failed', 'wa_connector_send_order_notification');

function wa_connector_send_order_notification($order_id) {
    error_log('WhatsApp Connector: Order notification triggered for ID ' . $order_id);
    
    $order = wc_get_order($order_id);
    if (!$order) {
        error_log('WhatsApp Connector: Could not load order object for ID ' . $order_id);
        return;
    }
    
    $webhook_url = wa_connector_get_webhook_url();
    if (!$webhook_url) return;
    
    $current_hook = current_action();
    $event_type = 'woocommerce.order_processing';
    
    if ($current_hook === 'woocommerce_new_order') {
        $event_type = 'woocommerce.order_created';
    } elseif ($current_hook === 'woocommerce_order_status_completed') {
        $event_type = 'woocommerce.order_completed';
    } elseif ($current_hook === 'woocommerce_order_status_cancelled') {
        $event_type = 'woocommerce.order_cancelled';
    } elseif ($current_hook === 'woocommerce_order_status_failed') {
        $event_type = 'woocommerce.order_failed';
    }
    
    $data = [
        'event' => $event_type,
        'order_id' => $order_id,
        'order_number' => $order->get_order_number(),
        'customer_name' => $order->get_billing_first_name() . ' ' . $order->get_billing_last_name(),
        'customer_phone' => $order->get_billing_phone(),
        'customer_email' => $order->get_billing_email(),
        'order_total' => $order->get_total(),
        'currency' => $order->get_currency(),
        'order_status' => $order->get_status(),
        'site_id' => get_option('wa_connector_site_id', ''),
        'site_name' => get_bloginfo('name'),
        'site_url' => get_site_url(),
        'created_at' => date('c')
    ];
    
    wa_connector_send_webhook($data);
}

function wa_connector_send_webhook($data) {
    $url = wa_connector_get_webhook_url();
    if (get_option('wa_connector_enabled') !== 'yes') return false;
    if (!$url) {
        error_log('WhatsApp Connector Webhook Error: webhook URL is empty or invalid.');
        return false;
    }
    
    $payload = json_encode($data);
    $webhook_secret = (string) get_option('wa_connector_webhook_secret', '');
    $headers = ['Content-Type' => 'application/json'];

    if (!empty($webhook_secret)) {
        $headers['X-WordPress-Webhook-Signature'] = hash_hmac('sha256', $payload, $webhook_secret);
    }
    if (!empty($data['site_id'])) {
        $headers['X-WordPress-Site-Id'] = $data['site_id'];
    }
    
    $response = wp_remote_post($url, [
        'body' => $payload,
        'headers' => $headers,
        'timeout' => 30,
        'sslverify' => (strpos($url, 'localhost') !== false) ? false : true
    ]);
    
    if (is_wp_error($response)) {
        error_log('WhatsApp Connector Webhook Error: ' . $response->get_error_message());
        return false;
    }

    $status_code = wp_remote_retrieve_response_code($response);
    if ($status_code < 200 || $status_code >= 300) {
        $response_body = wp_remote_retrieve_body($response);
        error_log('WhatsApp Connector Webhook Error: endpoint returned HTTP ' . $status_code . ' for ' . $url . '. Response: ' . $response_body);
        return false;
    }

    error_log('WhatsApp Connector: Webhook delivered successfully to ' . $url . ' with status ' . $status_code);
    
    return true;
}

function wa_connector_connect_platform($override_connect_url = '') {
    $connect_url = wa_connector_normalize_connection_url($override_connect_url);
    if (empty($connect_url)) {
        $connect_url = wa_connector_get_connection_url();
    }

    if (!$connect_url) {
        return new WP_Error('missing_connection_url', 'Connection URL is empty. Generate a connect link in your dashboard first.');
    }

    $saved_tables = get_option('wa_connector_tables', '[]');
    $tables_array = json_decode($saved_tables, true);
    if (!is_array($tables_array)) {
        $tables_array = [];
    }

    $payload = [
        'site_name' => get_bloginfo('name'),
        'site_url' => get_site_url(),
        'site_id' => get_option('wa_connector_site_id', ''),
        'plugin_version' => '2.3',
        'capabilities' => [
            'woocommerce' => class_exists('WooCommerce'),
            'custom_tables' => count($tables_array),
        ],
    ];

    $response = wp_remote_post($connect_url, [
        'body' => wp_json_encode($payload),
        'headers' => ['Content-Type' => 'application/json'],
        'timeout' => 30,
        'sslverify' => (strpos($connect_url, 'localhost') !== false) ? false : true
    ]);

    if (is_wp_error($response)) {
        return $response;
    }

    $status_code = wp_remote_retrieve_response_code($response);
    $response_body = wp_remote_retrieve_body($response);
    $data = json_decode($response_body, true);

    if ($status_code < 200 || $status_code >= 300 || !is_array($data)) {
        return new WP_Error('platform_connect_failed', 'Platform connection failed. Response: ' . $response_body);
    }

    update_option('wa_connector_connection_url', $connect_url);
    if (!empty($data['webhook_url'])) {
        update_option('wa_connector_webhook_url', wa_connector_normalize_webhook_url($data['webhook_url']));
    }
    if (!empty($data['site_id'])) {
        update_option('wa_connector_site_id', sanitize_text_field($data['site_id']));
    }
    if (!empty($data['webhook_secret'])) {
        update_option('wa_connector_webhook_secret', sanitize_text_field($data['webhook_secret']));
    }

    update_option('wa_connector_enabled', 'yes');

    return $data;
}
