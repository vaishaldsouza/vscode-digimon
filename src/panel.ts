import * as vscode from 'vscode';
import {
    DigimonType,
    DigimonSize,
    SPRITE_SIZES,
    FLOOR_HEIGHTS,
    DIGIMON_DEFS,
} from './types';

export class DigimonViewProvider implements vscode.WebviewViewProvider {
    private _view?: vscode.WebviewView;

    public activeDigimons: string[] = [];

    constructor(private readonly _extensionUri: vscode.Uri) {}

    public resolveWebviewView(webviewView: vscode.WebviewView) {
        this._view = webviewView;
        webviewView.webview.options = {
            enableScripts: true,
            localResourceRoots: [this._extensionUri],
        };
        webviewView.webview.html = this._getHtml(webviewView.webview);

        webviewView.webview.onDidReceiveMessage((msg) => {
            if (msg.command === 'state-update') {
                this.activeDigimons = msg.activeDigimons;
            } else if (msg.command === 'show-error') {
                vscode.window.showInformationMessage(msg.text);
            }
        });

        vscode.workspace.onDidChangeConfiguration((e) => {
            if (e.affectsConfiguration('vscode-digimon') && this._view) {
                this._view.webview.html = this._getHtml(this._view.webview);
                this.activeDigimons = []; // reset state on reload
            }
        });
    }

    public refresh() {
        if (this._view) {
            this._view.webview.html = this._getHtml(this._view.webview);
        }
    }

    public postMessage(message: any) {
        this._view?.webview.postMessage(message);
    }

    private _uri(webview: vscode.Webview, ...pathParts: string[]): string {
        return webview
            .asWebviewUri(vscode.Uri.joinPath(this._extensionUri, 'media', ...pathParts))
            .toString();
    }

    private _getHtml(webview: vscode.Webview): string {
        const cfg = vscode.workspace.getConfiguration('vscode-digimon');
        const digimonType = cfg.get<DigimonType>('digimonType', 'agumon');
        const digimonSize = cfg.get<DigimonSize>('digimonSize', 'medium');
        const speedMult   = cfg.get<number>('speedMultiplier', 1.0);

        const spriteSize = SPRITE_SIZES[digimonSize];
        const floor      = FLOOR_HEIGHTS[digimonSize];
        const defsJson = JSON.stringify(DIGIMON_DEFS);
        
        const uris = {
            agumon: this._uri(webview, 'agumon'),
            gabumon: this._uri(webview, 'gabumon'),
            patamon: this._uri(webview, 'patamon'),
        };
        const urisJson = JSON.stringify(uris);

        const csp = [
            `default-src 'none'`,
            `img-src ${webview.cspSource}`,
            `style-src 'unsafe-inline'`,
            `script-src 'unsafe-inline'`,
        ].join('; ');

        const baseSpeed = digimonSize === 'small' ? 2 : digimonSize === 'large' ? 6 : 4;
        const speed = baseSpeed * speedMult;

        return /* html */ `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta http-equiv="Content-Security-Policy" content="${csp}">
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }

  body {
    width: 100%;
    height: 100vh;
    overflow: hidden;
    background: #000;
  }

  #petsContainer {
    position: fixed;
    bottom: ${floor}px;
    left: 0;
    right: 0;
    height: calc(100vh - ${floor}px);
    pointer-events: none;
  }

  .pet {
    position: absolute;
    bottom: 0;
    left: 0;
    width: ${spriteSize}px;
    image-rendering: pixelated;
    pointer-events: none;
    z-index: 2;

    /* To blend a WHITE background from your GIF, uncomment the line below: */
    /* mix-blend-mode: multiply; */

    /* To blend a BLACK background from your GIF, uncomment the line below: */
    /* mix-blend-mode: screen; */
  }

  .collision {
    position: absolute;
    bottom: 0;
    left: 0;
    width: ${spriteSize}px;
    height: ${spriteSize}px;
    pointer-events: all;
    z-index: 3;
    cursor: pointer;
  }

  .bubble {
    position: absolute;
    bottom: ${spriteSize + 6}px;
    left: 0;
    background: rgba(20, 20, 20, 0.92);
    color: #fff;
    border: 1px solid rgba(255, 255, 255, 0.18);
    border-radius: 6px;
    padding: 4px 10px;
    font: 11px/1.4 monospace;
    white-space: nowrap;
    pointer-events: none;
    opacity: 0;
    transition: opacity 0.2s ease;
    z-index: 4;
  }
  .bubble.visible { opacity: 1; }
  .bubble::after {
    content: '';
    position: absolute;
    bottom: -6px;
    left: 12px;
    border: 6px solid transparent;
    border-top-color: rgba(255, 255, 255, 0.18);
    border-bottom: 0;
  }
</style>
</head>
<body>
  <div id="petsContainer"></div>

<script>
(function () {
  const vscodeApi = acquireVsCodeApi();
  const URIS         = ${urisJson};
  const SPRITE_SIZE  = ${spriteSize};
  const SPEED        = ${speed};
  const DEFS         = ${defsJson};

  function spriteUrl(type, state) {
    return URIS[type] + '/' + state + '.gif';
  }

  const SEQ = {
    walkRight: { sprite: 'walk_right', nextStates: ['walkLeft', 'sitIdle'],   minFrames: 80,  maxFrames: 180 },
    walkLeft:  { sprite: 'walk_left',  nextStates: ['walkRight', 'sitIdle'],  minFrames: 80,  maxFrames: 180 },
    sitIdle:   { sprite: 'idle',       nextStates: ['walkRight', 'walkLeft'], minFrames: 40,  maxFrames: 100 },
  };

  function randInt(min, max) {
    return Math.floor(Math.random() * (max - min)) + min;
  }

  function createDigimon(startLeft, type) {
    const container = document.getElementById('petsContainer');
    const def = DEFS[type];

    const img = document.createElement('img');
    img.className = 'pet';
    img.style.left = startLeft + 'px';
    container.appendChild(img);

    const col = document.createElement('div');
    col.className = 'collision';
    col.style.left = startLeft + 'px';
    container.appendChild(col);

    const bubble = document.createElement('div');
    bubble.className = 'bubble';
    bubble.style.left = startLeft + 'px';
    bubble.textContent = def.label + '!';
    container.appendChild(bubble);

    let state = 'walkRight';
    let framesLeft = randInt(SEQ.walkRight.minFrames, SEQ.walkRight.maxFrames);
    let x = startLeft;

    function setSprite(s) {
      img.src = spriteUrl(type, SEQ[s].sprite);
    }

    function transition() {
      const options = SEQ[state].nextStates;
      state = options[Math.floor(Math.random() * options.length)];
      framesLeft = randInt(SEQ[state].minFrames, SEQ[state].maxFrames);
      setSprite(state);
    }

    function move() {
      const maxX = window.innerWidth - SPRITE_SIZE - 2;

      if (state === 'walkRight') {
        x = Math.min(x + SPEED, maxX);
        if (x >= maxX) { transition(); return; }
      } else if (state === 'walkLeft') {
        x = Math.max(x - SPEED, 0);
        if (x <= 0) { transition(); return; }
      }

      img.style.left    = x + 'px';
      col.style.left    = x + 'px';
      bubble.style.left = x + 'px';

      framesLeft--;
      if (framesLeft <= 0) { transition(); }
    }

    col.addEventListener('mouseover', () => {
      bubble.textContent = def.phrases[Math.floor(Math.random() * def.phrases.length)];
      bubble.classList.add('visible');
    });
    col.addEventListener('mouseout', () => {
      bubble.classList.remove('visible');
    });

    setSprite(state);
    
    function remove() {
        img.remove();
        col.remove();
        bubble.remove();
    }

    return { type, move, remove };
  }

  const digimons = [];
  
  function syncState() {
      vscodeApi.postMessage({
          command: 'state-update',
          activeDigimons: digimons.map(d => d.type)
      });
  }

  // initial default spawn
  digimons.push(createDigimon(20, '${digimonType}'));
  syncState();

  setInterval(() => {
    digimons.forEach(d => d.move());
  }, 100);

  window.addEventListener('message', (event) => {
    const msg = event.data;
    if (msg.command === 'spawn-digimon') {
      const activeTypes = digimons.map(d => d.type);
      if (activeTypes.includes(msg.type)) {
          vscodeApi.postMessage({ command: 'show-error', text: 'You already have a ' + DEFS[msg.type].label + '!'});
          return;
      }
      const startX = randInt(20, Math.max(40, window.innerWidth - 80));
      digimons.push(createDigimon(startX, msg.type));
      syncState();
    }
    if (msg.command === 'remove-digimon') {
      const idx = digimons.findIndex(d => d.type === msg.type);
      if (idx !== -1) {
          digimons[idx].remove();
          digimons.splice(idx, 1);
          syncState();
      }
    }
  });
}());
</script>
</body>
</html>`;
    }
}
