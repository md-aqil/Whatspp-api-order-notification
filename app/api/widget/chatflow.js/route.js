import { NextResponse } from 'next/server'
import { getBranding } from '@/lib/providers/branding-provider'

export const dynamic = 'force-dynamic'

export async function GET(request) {
  try {
    const url = new URL(request.url)
    const userId = url.searchParams.get('userId')
    
    if (!userId || userId === 'default') {
      return new NextResponse('console.error("Chatflow widget failed to load: Missing or invalid userId parameter");', {
        headers: { 'Content-Type': 'application/javascript' },
      });
    }

    const branding = await getBranding(userId)

    // Return a self-executing widget loader script
    const script = `
(function() {
  var config = ${JSON.stringify(branding)};

  // Create floating toggle button
  var btn = document.createElement('button');
  btn.id = 'chatflow-toggle';
  btn.setAttribute('aria-label', 'Open chat with ' + config.businessName);
  btn.style.cssText = [
    'position:fixed',
    'z-index:999999',
    'width:56px',
    'height:56px',
    'border-radius:50%',
    'border:none',
    'cursor:pointer',
    'box-shadow:0 4px 16px rgba(0,0,0,0.2)',
    'transition:all 0.3s ease',
    'display:flex',
    'align-items:center',
    'justify-content:center',
    'background-color:' + config.primaryColor,
    'bottom:24px',
    'right:24px'
  ].join(';');

  if (config.logoUrl) {
    var img = document.createElement('img');
    img.src = config.logoUrl;
    img.alt = config.businessName;
    img.style.cssText = 'width:28px;height:28px;border-radius:50%;object-fit:cover;background:rgba(255,255,255,0.2);padding:2px;';
    btn.appendChild(img);
  } else {
    var icon = document.createElement('span');
    icon.textContent = '💬';
    icon.style.fontSize = '24px';
    btn.appendChild(icon);
  }

  // Position
  if (config.position === 'bottom-left') {
    btn.style.right = 'auto';
    btn.style.left = '24px';
  }

  // Mobile responsive
  var isMobile = window.innerWidth < 768;
  if (isMobile) {
    btn.style.width = '50px';
    btn.style.height = '50px';
    btn.style.bottom = '16px';
    btn.style.right = config.position === 'bottom-left' ? 'auto' : '16px';
    btn.style.left = config.position === 'bottom-left' ? '16px' : 'auto';
  }

  // Hover effect
  btn.addEventListener('mouseenter', function() {
    btn.style.transform = 'scale(1.1)';
    btn.style.boxShadow = '0 6px 24px ' + config.primaryColor + '44';
  });
  btn.addEventListener('mouseleave', function() {
    btn.style.transform = 'scale(1)';
    btn.style.boxShadow = '0 4px 16px rgba(0,0,0,0.2)';
  });

  // Load widget iframe on click
  btn.addEventListener('click', function() {
    var iframe = document.getElementById('chatflow-widget-iframe');
    if (iframe) {
      iframe.remove();
      return;
    }

    iframe = document.createElement('iframe');
    iframe.id = 'chatflow-widget-iframe';
    iframe.style.cssText = [
      'position:fixed',
      'z-index:999998',
      'width:400px',
      'height:560px',
      'border:none',
      'border-radius:16px',
      'box-shadow:0 20px 60px rgba(0,0,0,0.15)',
      'overflow:hidden',
      'background:#fff',
      'bottom:' + (isMobile ? '0' : '32px'),
      'right:' + (config.position === 'bottom-left' ? 'auto' : (isMobile ? '0' : '32px')),
      'left:' + (config.position === 'bottom-left' ? (isMobile ? '0' : '32px') : 'auto'),
      'display:none'
    ].join(';');

    // Build widget URL with branding params
    var widgetUrl = '/api/widget/chatflow-frame?' +
      'userId=' + encodeURIComponent(config.userId) +
      '&bgColor=' + encodeURIComponent(config.primaryColor) +
      '&botName=' + encodeURIComponent(config.botName) +
      '&businessName=' + encodeURIComponent(config.businessName) +
      '&welcomeMessage=' + encodeURIComponent(config.welcomeMessage) +
      (config.logoUrl ? '&logoUrl=' + encodeURIComponent(config.logoUrl) : '') +
      '&position=' + encodeURIComponent(config.position);

    iframe.src = widgetUrl;
    iframe.onload = function() {
      iframe.style.display = 'block';
    };

    document.body.appendChild(iframe);

    // Close on ESC
    var escHandler = function(e) {
      if (e.key === 'Escape' && iframe) {
        iframe.remove();
        document.removeEventListener('keydown', escHandler);
      }
    };
    setTimeout(function() {
      document.addEventListener('keydown', escHandler);
    }, 100);
  });

  document.body.appendChild(btn);
})();
    `;

    return new NextResponse(script, {
      headers: {
        'Content-Type': 'application/javascript',
        'Cache-Control': 'public, max-age=3600',
      },
    });
  } catch (error) {
    console.error('Widget script error:', error);
    return new NextResponse('console.error("Chatflow widget failed to load");', {
      headers: { 'Content-Type': 'application/javascript' },
    });
  }
}
