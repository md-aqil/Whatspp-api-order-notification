<?php
/**
 * Plugin Name: WhatsApp Automation Connector
 * Description: Connect WooCommerce and custom WordPress tables to WhatsApp automation
 * Version: 2.1.0
 */

if (!defined('ABSPATH'))
    exit;

// Register ALL Settings
function wa_connector_register_settings()
{
    // General
    register_setting('wa_connector_group', 'wa_connector_enabled');
    register_setting('wa_connector_group', 'wa_connector_webhook_url');
    register_setting('wa_connector_group', 'wa_connector_debug');

    // WooCommerce (ALL triggers)
    register_setting('wa_connector_group', 'wa_connector_woocommerce_enabled');
    register_setting('wa_connector_group', 'wa_connector_woo_created');
    register_setting('wa_connector_group', 'wa_connector_woo_paid');
    register_setting('wa_connector_group', 'wa_connector_woo_processing');
    register_setting('wa_connector_group', 'wa_connector_woo_completed');
    register_setting('wa_connector_group', 'wa_connector_woo_refunded');
    register_setting('wa_connector_group', 'wa_connector_woo_cancelled');
    register_setting('wa_connector_group', 'wa_connector_woo_failed');

    // Custom Tables
    register_setting('wa_connector_group', 'wa_connector_custom_enabled');
    register_setting('wa_connector_group', 'wa_connector_custom_tables_json');
}
add_action('admin_init', 'wa_connector_register_settings');

// Admin Menu
function wa_connector_add_admin_menu()
{
    add_menu_page('WhatsApp Connector', 'WA Connector', 'manage_options', 'wa-connector', 'wa_connector_admin_page', 'dashicons-email', 100);
}
add_action('admin_menu', 'wa_connector_add_admin_menu');

// AJAX: Get full config for app sync
add_action('wp_ajax_wa_get_config', 'wa_connector_ajax_get_config');
add_action('wp_ajax_nopriv_wa_get_config', 'wa_connector_ajax_get_config');

function wa_connector_ajax_get_config()
{
    header('Content-Type: application/json');

    // Get WooCommerce triggers with proper value format for App
    $woo_triggers = [];
    // Map trigger names to the option keys used in admin form
    $woo_trigger_configs = [
        ['name' => 'order_created', 'option' => 'wa_connector_woo_created', 'label' => 'Order Created', 'value' => 'woocommerce.order_created', 'description' => 'When a new order is created'],
        ['name' => 'order_paid', 'option' => 'wa_connector_woo_paid', 'label' => 'Order Paid', 'value' => 'woocommerce.order_paid', 'description' => 'When payment is received'],
        ['name' => 'order_processing', 'option' => 'wa_connector_woo_processing', 'label' => 'Order Processing', 'value' => 'woocommerce.order_processing', 'description' => 'When order is being processed'],
        ['name' => 'order_completed', 'option' => 'wa_connector_woo_completed', 'label' => 'Order Completed', 'value' => 'woocommerce.order_completed', 'description' => 'When order is completed'],
        ['name' => 'order_refunded', 'option' => 'wa_connector_woo_refunded', 'label' => 'Order Refunded', 'value' => 'woocommerce.order_refunded', 'description' => 'When order is refunded'],
        ['name' => 'order_cancelled', 'option' => 'wa_connector_woo_cancelled', 'label' => 'Order Cancelled', 'value' => 'woocommerce.order_cancelled', 'description' => 'When order is cancelled'],
        ['name' => 'order_failed', 'option' => 'wa_connector_woo_failed', 'label' => 'Order Failed', 'value' => 'woocommerce.order_failed', 'description' => 'When order is failed']
    ];

    foreach ($woo_trigger_configs as $config) {
        if (get_option($config['option']) === 'yes') {
            $woo_triggers[] = $config;
        }
    }

    // Get Custom tables - format for App
    $tables_json = get_option('wa_connector_custom_tables_json', '[]');
    $raw_tables = json_decode($tables_json, true) ?: [];

    // Format tables with proper structure for App
    $tables = [];
    foreach ($raw_tables as $table) {
        $tables[] = [
            'name' => $table['name'] ?? 'wp_custom_table',
            'label' => $table['label'] ?? 'Custom Table',
            'columns' => $table['columns'] ?? []
        ];
    }

    echo json_encode([
        'success' => true,
        'enabled' => get_option('wa_connector_enabled') === 'yes' || get_option('wa_connector_woocommerce_enabled') === 'yes',
        'webhook_url' => get_option('wa_connector_webhook_url', 'https://lcsw.dpdns.org/api/webhook/custom'),
        'woocommerce' => [
            'enabled' => get_option('wa_connector_woocommerce_enabled') === 'yes',
            'triggers' => $woo_triggers
        ],
        'custom_tables' => [
            'enabled' => get_option('wa_connector_custom_enabled') === 'yes',
            'tables' => $tables
        ]
    ]);
    wp_die();
}

// Admin Page
function wa_connector_admin_page()
{
    $active_tab = isset($_GET['tab']) ? sanitize_text_field($_GET['tab']) : 'settings';
    $default_webhook = 'https://lcsw.dpdns.org/api/webhook/custom';
    $tables_json = get_option('wa_connector_custom_tables_json', '[]');
    $tables = json_decode($tables_json, true) ?: [];

    $woo_triggers = [
        'wa_connector_woo_created' => 'Order Created',
        'wa_connector_woo_paid' => 'Order Paid (Payment Received)',
        'wa_connector_woo_processing' => 'Order Processing',
        'wa_connector_woo_completed' => 'Order Completed',
        'wa_connector_woo_refunded' => 'Order Refunded',
        'wa_connector_woo_cancelled' => 'Order Cancelled',
        'wa_connector_woo_failed' => 'Order Failed'
    ];
?>
<div class="wrap">
    <h1>WhatsApp Automation Connector 🚀</h1>
    <h2 class="nav-tab-wrapper">
        <a href="?page=wa-connector&tab=settings"
            class="nav-tab <?php echo $active_tab == 'settings' ? 'nav-tab-active' : ''; ?>">⚙️ Settings</a>
        <a href="?page=wa-connector&tab=woocommerce"
            class="nav-tab <?php echo $active_tab == 'woocommerce' ? 'nav-tab-active' : ''; ?>">🛒 WooCommerce</a>
        <a href="?page=wa-connector&tab=custom"
            class="nav-tab <?php echo $active_tab == 'custom' ? 'nav-tab-active' : ''; ?>">📋 Custom Tables</a>
    </h2>

    <?php if ($active_tab == 'settings'): ?>
    <div class="postbox" style="margin-top:20px;padding:20px;">
        <h2>⚙️ General Settings</h2>
        <form method="post" action="options.php">
            <?php settings_fields('wa_connector_group'); ?>
            <table class="form-table">
                <tr>
                    <th>Enable Connector</th>
                    <td><select name="wa_connector_enabled">
                            <option value="yes" <?php selected(get_option('wa_connector_enabled'), 'yes' ); ?>>Yes -
                                Active
                            </option>
                            <option value="no" <?php selected(get_option('wa_connector_enabled'), 'no' ); ?>>No -
                                Disabled
                            </option>
                        </select></td>
                </tr>
                <tr>
                    <th>Webhook URL</th>
                    <td><input type="url" name="wa_connector_webhook_url"
                            value="<?php echo esc_attr(get_option('wa_connector_webhook_url', $default_webhook)); ?>"
                            class="regular-text" /></td>
                </tr>
                <tr>
                    <th>Debug Mode</th>
                    <td><select name="wa_connector_debug">
                            <option value="yes" <?php selected(get_option('wa_connector_debug'), 'yes' ); ?>>Yes
                            </option>
                            <option value="no" <?php selected(get_option('wa_connector_debug'), 'no' ); ?>>No</option>
                        </select></td>
                </tr>
            </table>
            <?php submit_button('Save Settings'); ?>
        </form>
        <hr>
        <p><strong>Webhook URL:</strong> <code
                style="background:#d4edda;padding:5px 10px;"><?php echo $default_webhook; ?></code></p>
        <p><small>Your app will receive events at this URL. The Automation Studio will automatically sync configured
                tables and triggers.</small></p>
    </div>

    <?php
    elseif ($active_tab == 'woocommerce'): ?>
    <div class="postbox" style="margin-top:20px;padding:20px;">
        <h2>🛒 WooCommerce Triggers</h2>
        <p>Select which order events should send WhatsApp notifications. These will appear in your Automation Studio.
        </p>

        <form method="post" action="options.php">
            <?php settings_fields('wa_connector_group'); ?>
            <input type="hidden" name="wa_connector_woocommerce_enabled" value="yes">

            <table class="form-table">
                <?php foreach ($woo_triggers as $key => $label): ?>
                <tr>
                    <th>
                        <?php echo $label; ?>
                    </th>
                    <td><label><input type="checkbox" name="<?php echo $key; ?>" value="yes" <?php
            checked(get_option($key), 'yes' ); ?> /> Enable</label></td>
                </tr>
                <?php
        endforeach; ?>
            </table>

            <?php submit_button('Save WooCommerce Settings'); ?>
        </form>

        <hr>
        <p><strong>These triggers will be available in your Automation Studio:</strong></p>
        <ul>
            <?php foreach ($woo_triggers as $key => $label):
            if (get_option($key) === 'yes'): ?>
            <li style="color:green;">✓
                <?php echo $label; ?>
            </li>
            <?php
            else: ?>
            <li style="color:#ccc;">○
                <?php echo $label; ?>
            </li>
            <?php
            endif;
        endforeach; ?>
        </ul>
    </div>

    <?php
    else: // custom tables ?>
    <div class="postbox" style="margin-top:20px;padding:20px;">
        <h2>📋 Custom Tables Configuration</h2>
        <p>Add multiple database tables. Each table can have its own field mappings. Tables will be available in Automation Studio dropdown.</p>
        
        <form method="post" action="options.php">
            <?php settings_fields('wa_connector_group'); ?>
    <input type="hidden" name="wa_connector_custom_tables_json" id="wa_tables_json"
        value="<?php echo esc_attr($tables_json); ?>">
    <input type="hidden" name="wa_connector_custom_enabled" value="yes">

    <p><label><input type="checkbox" checked disabled /> Enable Custom Table Notifications</label></p>
    <hr>

    <div id="wa-tables-container">
        <?php if (empty($tables)): ?>
        <p>No tables configured. Click "Add Table" below.</p>
        <?php
        else:
            foreach ($tables as $i => $t): ?>
        <div class="wa-table-config"
            style="background:#f5f5f5;padding:15px;margin-bottom:15px;border-radius:5px;border:1px solid #ddd;">
            <h4>Table:
                <?php echo esc_html($t['name'] ?: 'NEW'); ?> <span style="color:green;">✓ Active</span>
            </h4>
            <table class="form-table">
                <tr>
                    <th>Table Name</th>
                    <td><input type="text" class="wa-table-name" value="<?php echo esc_attr($t['name'] ?? ''); ?>"
                            placeholder="wp_orders"></td>
                </tr>
                <tr>
                    <th>ID Column</th>
                    <td><input type="text" class="wa-table-id" value="<?php echo esc_attr($t['id_column'] ?? 'id'); ?>"
                            style="width:100px;"></td>
                </tr>
                <tr>
                    <th>Field Mappings</th>
                    <td>
                        Customer Name: <input type="text" class="wa-map-name"
                            value="<?php echo esc_attr($t['mappings']['customer_name'] ?? ''); ?>"
                            placeholder="name"><br>
                        Customer Phone: <input type="text" class="wa-map-phone"
                            value="<?php echo esc_attr($t['mappings']['customer_phone'] ?? ''); ?>"
                            placeholder="phone"><br>
                        Order Number: <input type="text" class="wa-map-order"
                            value="<?php echo esc_attr($t['mappings']['order_number'] ?? ''); ?>" placeholder="id"><br>
                        Order Total: <input type="text" class="wa-map-total"
                            value="<?php echo esc_attr($t['mappings']['order_total'] ?? ''); ?>" placeholder="total">
                    </td>
                </tr>
            </table>
            <button type="button" class="button wa-remove-table" style="color:red;">Remove Table</button>
        </div>
        <?php
            endforeach;
        endif; ?>
    </div>

    <button type="button" id="wa-add-table" class="button button-primary">+ Add Table</button>
    <?php submit_button('Save All Tables'); ?>
    </form>

    <hr>
    <h3>Configured Tables (will sync to Automation Studio):</h3>
    <ul>
        <?php if (empty($tables)): ?>
        <li style="color:#ccc;">No tables configured</li>
        <?php
        else:
            foreach ($tables as $t): ?>
        <li style="color:green;">✓
            <?php echo esc_html($t['name']); ?> -
            <?php echo esc_html($t['mappings']['customer_name'] ?: 'no mapping'); ?>
        </li>
        <?php
            endforeach;
        endif; ?>
    </ul>

    <hr>
    <h3>How to Use</h3>
    <pre style="background:#f5f5f5;padding:10px;border-radius:5px;">// Trigger from your custom code
wa_trigger_custom_notification('wp_orders', $record_id, ['name'=>'John','phone'=>'919999999999']);
do_action('wa_connector_custom_table_updated', 'wp_orders', $record_id, $data);</pre>

    <script>
        jQuery(function ($) {
            function saveTables() {
                var tables = [];
                $('.wa-table-config').each(function () {
                    var t = {
                        name: $(this).find('.wa-table-name').val(),
                        id_column: $(this).find('.wa-table-id').val() || 'id',
                        mappings: {
                            customer_name: $(this).a - name').val(),
                        customer_phone: $(this).find('.wa        -phone').val(),
                            order_number: $(this).find('.wa-map-order').val(),
                            rder_total: $(this).find('.wa-maptal').val()
                        }
                    };
                    if (t.name) tables.push(t);
                });
                $('#wa_tables_json').val(JSON.stringify(tables));
            }
            $('#wa-add-table').click(function () {
                var h = '<div class="wa-table-config" style="background:#f5f5f5;padding:15px;margin-bottom:15px;border-radius:5px;border:1px solid #ddd;"><h4>Table: NEW</h4><table class="form-table"><tr><th>Table</th><td><input type="text" class="wa-table-name" value="" placeholder="wp_orders"></td></tr><tr><th>ID</th><td><input type="text" class="wa-table-id" value="id" style="width:100px;"></td></tr><tr><th>Mappings</th><td>Name: <input type="text" class="wa-map-name"><br>Phone: <input type="text" class="wa-map-phone"><br>Order#: <input type="text" class="wa-map-order"><br>Total: <input type="text" class="wa-map-total"></td></tr></table><button type="button" class="button wa-remove-table" style="color:red;">Remove</button></div>';
                $('#wa-tables-container').append(h);
                $('.wa-remove-table').click(function () { $(this).closest('.wa-table-config').remove(); saveTables(); });
            });
            $('.wa-remove-table').click(function () { $(this).closest('.wa-table-config').remove(); saveTables(); });
            $('form').submit(function () { saveTables(); });
        });
    </script>
</div>
<?php
    endif; ?>
</div>
<?php
}

// Webhook sender
function wa_connector_send_webhook($data)
{
    $url = get_option('wa_connector_webhook_url', 'https://lcsw.dpdns.org/api/webhook/custom');
    if (get_option('wa_connector_enabled') !== 'yes')
        return ['success' => false, 'error' => 'Disabled'];
    wp_remote_post($url, ['body' => json_encode($data), 'headers' => ['Content-Type' => 'application/json'], 'timeout' => 30]);
}

// WooCommerce hooks - ALL triggers
$woo_hooks = [
    'wa_connector_woo_created' => ['hook' => 'woocommerce_order_created', 'event' => 'woocommerce.order_created'],
    'wa_connector_woo_paid' => ['hook' => 'woocommerce_order_status_processing', 'event' => 'woocommerce.order_paid'],
    'wa_connector_woo_processing' => ['hook' => 'woocommerce_order_status_processing', 'event' => 'woocommerce.order_processing'],
    'wa_connector_woo_completed' => ['hook' => 'woocommerce_order_status_completed', 'event' => 'woocommerce.order_completed'],
    'wa_connector_woo_refunded' => ['hook' => 'woocommerce_order_refunded', 'event' => 'woocommerce.order_refunded'],
    'wa_connector_woo_cancelled' => ['hook' => 'woocommerce_order_status_cancelled', 'event' => 'woocommerce.order_cancelled'],
    'wa_connector_woo_failed' => ['hook' => 'woocommerce_order_status_failed', 'event' => 'woocommerce.order_failed']
];

foreach ($woo_hooks as $option => $config) {
    add_action($config['hook'], function ($id, $o) use ($option, $config) {
        if (get_option('wa_connector_woocommerce_enabled') !== 'yes' || get_option($option) !== 'yes')
            return;
        wa_connector_send_webhook([
            'event' => $config['event'],
            'order_id' => $id,
            'order_number' => $o->get_order_number(),
            'customer_name' => $o->get_billing_first_name() . ' ' . $o->get_billing_last_name(),
            'customer_phone' => $o->get_billing_phone(),
            'order_total' => $o->get_total(),
            'currency' => $o->get_currency(),
            'status' => $o->get_status()
        ]);
    }, 10, 2);
}

// Custom table trigger
function wa_trigger_custom_notification($table_name, $record_id, $data = [])
{
    if (get_option('wa_connector_custom_enabled') !== 'yes')
        return;
    $tables_json = get_option('wa_connector_custom_tables_json', '[]');
    $tables = json_decode($tables_json, true) ?: [];
    $table = null;
    foreach ($tables as $t) {
        if ($t['name'] === $table_name) {
            $table = $t;
            break;
        }
    }
    if (!$table)
        return;
    wa_connector_send_webhook([
        'event' => 'custom.webhook',
        'source_table' => $table_name,
        'source_id' => $record_id,
        'field_mapping' => $table['mappings'] ?? []
    ] + $data);
}
add_action('wa_connector_custom_table_updated', 'wa_connector_on_custom_table', 10, 3);
function wa_connector_on_custom_table($table, $id, $data)
{
    wa_trigger_custom_notification($table, $id, $data);
}

// Helper function for external use
function wa_send_notification($event, $data)
{
    wa_connector_send_webhook(array_merge(['event' => $event], $data));
}