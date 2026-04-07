import * as vscode from 'vscode';

// Available Digimon roster
const DIGIMON_ROSTER = [
  { name: 'Agumon', file: 'agumon.gif' },
  { name: 'Gabumon', file: 'gabumon.gif' },
  { name: 'Patamon', file: 'patamon.gif' },
];

let currentDigimonIndex = 0;
let currentProvider: DigimonViewProvider | undefined;

export function activate(context: vscode.ExtensionContext) {
  const provider = new DigimonViewProvider(context.extensionUri);
  currentProvider = provider;

  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider('digimon.viewport', provider)
  );

  // Command: cycle through Digimon
  context.subscriptions.push(
    vscode.commands.registerCommand('vscode-digimon.nextDigimon', () => {
      currentDigimonIndex = (currentDigimonIndex + 1) % DIGIMON_ROSTER.length;
      if (currentProvider) {
        currentProvider.refresh();
      }
      vscode.window.showInformationMessage(
        `🥚 Your new partner: ${DIGIMON_ROSTER[currentDigimonIndex].name}!`
      );
    })
  );
}

export function deactivate() {}

class DigimonViewProvider implements vscode.WebviewViewProvider {
  private _view?: vscode.WebviewView;

  constructor(private readonly _extensionUri: vscode.Uri) {}

  public refresh() {
    if (this._view) {
      this._view.webview.html = this._getHtml(this._view.webview);
    }
  }

  public resolveWebviewView(webviewView: vscode.WebviewView) {
    this._view = webviewView;

    webviewView.webview.options = {
      enableScripts: true,
      localResourceRoots: [this._extensionUri],
    };

    webviewView.webview.html = this._getHtml(webviewView.webview);
  }

  private _getHtml(webview: vscode.Webview): string {
    const digimon = DIGIMON_ROSTER[currentDigimonIndex];

    const spriteUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this._extensionUri, 'media', digimon.file)
    );

    const phrases = [
      'Scanning your code... 🔍',
      'Hungry for bits! 🍖',
      'DigiMon is watching! 👀',
      `${digimon.name} ATTACK! 🔥`,
      'Bug detected! Eliminating! ⚔️',
      'Keep coding, partner! 💪',
      'This code looks tasty! 😋',
      'Digivolving your skills! 🌟',
      'Network Alert! Secure the line! 📡',
      'Is that a missing semicolon? 😱',
      'I believe in you! 🤝',
      'The Digital World needs you! 🌐',
    ];

    return /* html */ `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src ${webview.cspSource} https:; style-src 'unsafe-inline'; script-src 'unsafe-inline';">
  <title>Digital World</title>
  <style>
    * {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
    }

    body {
      background: transparent;
      overflow: hidden;
      width: 100%;
      height: 100vh;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: flex-end;
      padding-bottom: 20px;
      font-family: 'Courier New', monospace;
    }

    /* Ground / scanline strip */
    .ground {
      position: fixed;
      bottom: 0;
      left: 0;
      right: 0;
      height: 40px;
      background: repeating-linear-gradient(
        90deg,
        rgba(0, 255, 180, 0.08) 0px,
        rgba(0, 255, 180, 0.08) 2px,
        transparent 2px,
        transparent 20px
      );
      border-top: 1px solid rgba(0,255,180,0.25);
    }

    /* Scanline overlay */
    .scanlines {
      pointer-events: none;
      position: fixed;
      top: 0; left: 0; right: 0; bottom: 0;
      background: repeating-linear-gradient(
        0deg,
        transparent,
        transparent 2px,
        rgba(0,0,0,0.07) 2px,
        rgba(0,0,0,0.07) 4px
      );
      z-index: 100;
    }

    /* Floating pixel particles */
    .particles {
      position: fixed;
      top: 0; left: 0; right: 0; bottom: 0;
      overflow: hidden;
      pointer-events: none;
    }
    .particle {
      position: absolute;
      width: 3px;
      height: 3px;
      background: rgba(0, 255, 180, 0.6);
      animation: floatUp linear infinite;
    }

    @keyframes floatUp {
      0%   { transform: translateY(100vh) translateX(0); opacity: 0.8; }
      100% { transform: translateY(-20px) translateX(var(--drift)); opacity: 0; }
    }

    /* Digimon container - walks back and forth */
    .digimon-stage {
      position: fixed;
      bottom: 42px;
      left: 0;
      right: 0;
      height: 140px;
      display: flex;
      align-items: flex-end;
    }

    .digimon-walker {
      position: absolute;
      bottom: 0;
      display: flex;
      flex-direction: column;
      align-items: center;
      animation: walkAcross 8s ease-in-out infinite alternate;
    }

    @keyframes walkAcross {
      0%   { left: 5%;  transform: scaleX(1); }
      45%  { left: 60%; transform: scaleX(1); }
      50%  { left: 60%; transform: scaleX(-1); }
      100% { left: 5%;  transform: scaleX(-1); }
    }

    .digimon-img {
      width: 80px;
      image-rendering: pixelated;
      image-rendering: crisp-edges;
      filter: drop-shadow(0 4px 12px rgba(0, 255, 180, 0.5));
      animation: bounce 0.5s ease-in-out infinite alternate;
      cursor: pointer;
      transition: filter 0.2s;
    }

    .digimon-img:hover {
      filter: drop-shadow(0 4px 20px rgba(0, 255, 255, 0.9)) brightness(1.2);
    }

    @keyframes bounce {
      0%   { transform: translateY(0px); }
      100% { transform: translateY(-4px); }
    }

    /* Speech bubble */
    .bubble {
      position: absolute;
      bottom: 110px;
      left: 50%;
      transform: translateX(-50%);
      background: rgba(10, 20, 30, 0.92);
      border: 1px solid rgba(0, 255, 180, 0.7);
      border-radius: 10px;
      padding: 7px 12px;
      font-size: 10px;
      color: #00ffb4;
      white-space: nowrap;
      max-width: 160px;
      white-space: normal;
      text-align: center;
      box-shadow: 0 0 14px rgba(0, 255, 180, 0.3), inset 0 0 6px rgba(0,255,180,0.08);
      opacity: 0;
      transition: opacity 0.4s ease;
      pointer-events: none;
      z-index: 50;
      line-height: 1.4;
    }

    .bubble::after {
      content: '';
      position: absolute;
      bottom: -7px;
      left: 50%;
      transform: translateX(-50%);
      width: 0; height: 0;
      border-left: 6px solid transparent;
      border-right: 6px solid transparent;
      border-top: 7px solid rgba(0, 255, 180, 0.7);
    }

    .bubble.show {
      opacity: 1;
    }

    /* Name plate */
    .name-plate {
      position: fixed;
      top: 10px;
      left: 50%;
      transform: translateX(-50%);
      background: linear-gradient(135deg, rgba(0,255,180,0.15), rgba(0,180,255,0.1));
      border: 1px solid rgba(0,255,180,0.4);
      border-radius: 20px;
      padding: 4px 14px 4px 10px;
      font-size: 10px;
      color: #00ffb4;
      display: flex;
      align-items: center;
      gap: 6px;
      letter-spacing: 0.5px;
      text-transform: uppercase;
      white-space: nowrap;
      box-shadow: 0 0 10px rgba(0,255,180,0.2);
    }

    .status-dot {
      width: 6px;
      height: 6px;
      border-radius: 50%;
      background: #00ff80;
      box-shadow: 0 0 6px #00ff80;
      animation: pulse 1.5s ease-in-out infinite;
    }

    @keyframes pulse {
      0%, 100% { opacity: 1; transform: scale(1); }
      50%       { opacity: 0.4; transform: scale(0.7); }
    }

    /* Click ripple effect */
    .ripple {
      position: fixed;
      border-radius: 50%;
      background: rgba(0, 255, 180, 0.3);
      animation: rippleOut 0.6s ease-out forwards;
      pointer-events: none;
      z-index: 200;
    }

    @keyframes rippleOut {
      0%   { width: 10px; height: 10px; opacity: 1; transform: translate(-50%,-50%) scale(0); }
      100% { width: 10px; height: 10px; opacity: 0; transform: translate(-50%,-50%) scale(12); }
    }

    /* Pixel digit counter */
    .stats-bar {
      position: fixed;
      bottom: 6px;
      left: 50%;
      transform: translateX(-50%);
      font-size: 8px;
      color: rgba(0, 255, 180, 0.5);
      letter-spacing: 1px;
      white-space: nowrap;
    }
  </style>
</head>
<body>

  <div class="scanlines"></div>
  <div class="particles" id="particles"></div>
  <div class="ground"></div>

  <div class="name-plate">
    <span class="status-dot"></span>
    <span id="digimon-name">${digimon.name}</span>
  </div>

  <div class="digimon-stage">
    <div class="digimon-walker" id="walker">
      <div class="bubble" id="bubble">...</div>
      <img
        id="sprite"
        class="digimon-img"
        src="${spriteUri}"
        alt="${digimon.name}"
        title="Click me!"
      />
    </div>
  </div>

  <div class="stats-bar" id="stats-bar">HP ████████ 100% · MP ████████ 100%</div>

  <script>
    const phrases = ${JSON.stringify(phrases)};
    const bubble = document.getElementById('bubble');
    const sprite = document.getElementById('sprite');

    // ── Spawn floating particles ──
    const container = document.getElementById('particles');
    for (let i = 0; i < 18; i++) {
      const p = document.createElement('div');
      p.className = 'particle';
      p.style.left = Math.random() * 100 + '%';
      p.style.animationDuration = (4 + Math.random() * 8) + 's';
      p.style.animationDelay = (Math.random() * 8) + 's';
      p.style.setProperty('--drift', (Math.random() * 40 - 20) + 'px');
      p.style.opacity = (0.3 + Math.random() * 0.7).toString();
      container.appendChild(p);
    }

    // ── Show speech bubble ──
    function showPhrase() {
      const text = phrases[Math.floor(Math.random() * phrases.length)];
      bubble.textContent = text;
      bubble.classList.add('show');
      setTimeout(() => bubble.classList.remove('show'), 3500);
    }

    // Show first phrase quickly, then randomly every 12–25s
    setTimeout(showPhrase, 2000);
    setInterval(showPhrase, Math.random() * 13000 + 12000);
    setInterval(() => {
      // Reschedule at random intervals
      setTimeout(showPhrase, Math.random() * 5000);
    }, 17000);

    // ── Click interaction ──
    sprite.addEventListener('click', (e) => {
      showPhrase();

      // Ripple effect
      const ripple = document.createElement('div');
      ripple.className = 'ripple';
      ripple.style.left = e.clientX + 'px';
      ripple.style.top  = e.clientY + 'px';
      document.body.appendChild(ripple);
      setTimeout(() => ripple.remove(), 700);
    });

    // ── Animate HP/MP bar drain & refill for fun ──
    let hp = 100, mp = 100, hpDir = -1, mpDir = 1;
    const BAR = '████████';
    const statsEl = document.getElementById('stats-bar');

    function updateStats() {
      hp = Math.min(100, Math.max(10, hp + hpDir * (Math.random() * 3)));
      mp = Math.min(100, Math.max(10, mp + mpDir * (Math.random() * 2)));
      if (hp <= 12) { hpDir = 1; }
      if (hp >= 99) { hpDir = -1; }
      if (mp <= 12) { mpDir = -1; }
      if (mp >= 99) { mpDir = 1; }

      const hpFill = Math.round(hp / 12.5);
      const mpFill = Math.round(mp / 12.5);
      const hpBar = '█'.repeat(hpFill) + '░'.repeat(8 - hpFill);
      const mpBar = '█'.repeat(mpFill) + '░'.repeat(8 - mpFill);
      statsEl.textContent = \`HP \${hpBar} \${Math.round(hp)}% · MP \${mpBar} \${Math.round(mp)}%\`;
    }

    setInterval(updateStats, 800);
  </script>
</body>
</html>`;
  }
}
