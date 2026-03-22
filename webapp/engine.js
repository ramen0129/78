// Sound Novel Engine with Dynamic Chapter Unlock System

let gameScenario = [];
let currentIndex = 0;
let isTyping = false;
let currentTextInterval = null;
let currentChapterId = "";
let isAutoMode = false;
let autoAdvanceTimeout = null;

const SAVE_KEY = "shota_growth_progress_v2";
const CHAPTER_ORDER = [
    'prologue', 'chapter1', 'chapter2', 'chapter3', 'chapter4', 
    'chapter5', 'chapter5_5', 'chapter6', 'chapter7', 'epilogue'
];

const menuScreen = document.getElementById('menu-screen');
const gameScreen = document.getElementById('game-screen');
const textBox = document.getElementById('text-box');
const speakerName = document.getElementById('speaker-name');
const clickIndicator = document.getElementById('click-indicator');
const effectLayer = document.getElementById('effect-layer');
const returnMenuBtn = document.getElementById('return-menu-btn');
const logBtn = document.getElementById('log-btn');
const autoBtn = document.getElementById('auto-btn');
const interactionArea = document.getElementById('interaction-area');
const dialoguePanel = document.getElementById('dialogue-panel');
const tooltipContainer = document.getElementById('tooltip-container');
const backlogScreen = document.getElementById('backlog-screen');
const backlogContent = document.getElementById('backlog-content');
const backlogCloseBtn = document.getElementById('backlog-close-btn');

function initSystem() {
    refreshMenuUI();
    
    // Bind Title Buttons
    document.querySelectorAll('.chapter-btn').forEach(btn => {
        // remove old listeners by cloning if necessary, but here it's safe since it's init
        btn.addEventListener('click', (e) => {
            if(e.target.classList.contains('locked')) return;
            startGame(e.target.getAttribute('data-target'));
        });
    });

    returnMenuBtn.addEventListener('click', () => {
        clearInterval(currentTextInterval);
        showMenu();
    });
    
    // Backlog Events
    logBtn.addEventListener('click', () => {
        if (isAutoMode) {
            isAutoMode = false;
            autoBtn.classList.remove('active');
            clearTimeout(autoAdvanceTimeout);
        }
        showBacklog();
    });
    backlogCloseBtn.addEventListener('click', () => {
        backlogScreen.style.display = 'none';
    });
    
    // Auto Events
    autoBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        isAutoMode = !isAutoMode;
        if (isAutoMode) {
            autoBtn.classList.add('active');
            if (!isTyping) {
                autoAdvanceTimeout = setTimeout(() => handleAdvance(), 1500);
            }
        } else {
            autoBtn.classList.remove('active');
            clearTimeout(autoAdvanceTimeout);
        }
    });
    
    // Game Advance Logic
    interactionArea.addEventListener('click', handleAdvance);
    dialoguePanel.addEventListener('click', handleAdvance);
    document.addEventListener('keydown', (e) => {
        if((e.code === 'Space' || e.code === 'Enter') && gameScreen.style.display === 'block') handleAdvance();
    });
    
    // Close tooltips
    document.addEventListener('click', (e) => {
        if(!e.target.classList.contains('tooltip-word') && !tooltipContainer.contains(e.target)) {
            tooltipContainer.classList.remove('show');
        }
    });
}

function refreshMenuUI() {
    let progressStr = localStorage.getItem(SAVE_KEY);
    let unlockedIndex = progressStr ? parseInt(progressStr) : 0;
    
    document.querySelectorAll('.chapter-btn').forEach(btn => {
        let target = btn.getAttribute('data-target');
        let index = CHAPTER_ORDER.indexOf(target);
        if (index <= unlockedIndex) {
            btn.classList.remove('locked');
        } else {
            btn.classList.add('locked');
        }
    });
}

window.resetProgress = function() {
    if(confirm("進行度をリセットしますか？（序章からの開始になります）")) {
        localStorage.removeItem(SAVE_KEY);
        refreshMenuUI();
    }
}

function showMenu() {
    refreshMenuUI();
    gameScreen.style.display = 'none';
    menuScreen.style.display = 'flex';
}

function showBacklog() {
    if (isTyping) {
        isTyping = false;
        clearInterval(currentTextInterval);
        const lineData = gameScenario[currentIndex];
        textBox.innerHTML = parseInlineCommands(lineData.text || "");
        bindTooltips();
        clickIndicator.style.display = 'block';
    }
    
    backlogContent.innerHTML = '';
    for (let i = 0; i <= currentIndex; i++) {
        const lineData = gameScenario[i];
        if (!lineData || !lineData.text) continue;
        
        const item = document.createElement('div');
        item.className = 'backlog-item';
        item.title = "クリックでこのシーンまで巻き戻る";
        
        let speakerHTML = '';
        if (lineData.speaker && lineData.speaker !== '語り手') {
            let spClass = lineData.speaker === '高橋先輩' || lineData.speaker === '佐藤先生' ? 'sub-character' : lineData.speaker;
            speakerHTML = `<div class="backlog-speaker ${spClass}">${lineData.speaker}</div>`;
        }
        
        item.innerHTML = speakerHTML + `<div>${parseInlineCommands(lineData.text)}</div>`;
        item.addEventListener('click', () => rewindTo(i));
        backlogContent.appendChild(item);
    }
    backlogScreen.style.display = 'flex';
    setTimeout(() => {
        backlogContent.scrollTop = backlogContent.scrollHeight;
    }, 10);
}

function rewindTo(index) {
    if (index >= 0 && index < currentIndex) {
        clearInterval(currentTextInterval);
        isTyping = false;
        clearTimeout(autoAdvanceTimeout);
        isAutoMode = false;
        if(autoBtn) autoBtn.classList.remove('active');

        currentIndex = index;
        backlogScreen.style.display = 'none';
        
        // Ensure game screen is visible
        document.getElementById('menu-screen').style.display = 'none';
        document.getElementById('game-screen').style.display = 'block';

        // Reset effects
        const gameContainer = document.getElementById('game-container');
        gameContainer.className = '';
        const effectLayer = document.getElementById('effect-layer');
        effectLayer.innerHTML = '';
        
        renderLine();
    }
}

function parseMarkdownToScenario(text) {
    const tips = {
        "分母ゼロの檻": "失敗を恐れて行动（挑戦）しないため、結果的に成功する確率が永遠にゼロのまま停滞してしまう心理的障壁のこと。",
        "素直さ（コーチャビリティ）": "ビジネスやスポーツにおいて「指導を素直に受け入れ、改善に繋げる能力」のこと。",
        "素直さ": "ビジネスやスポーツにおいて「指導を素直に受け入れ、改善に繋げる能力」のこと。",
        "事実と感情の切り離し": "メタ認知の一種。ここではノートに事実と感情を書き分けることで思考を可視化している。",
        "メタ認知": "自分自身の感情や思考を客観的（第三者視点）に観察し、冷静にコントロールする能力。",
        "WhoとWhatの分離": "相手の言葉のうち、感情的な『誰が言ったか』『どう言ったか』（Who）でなく、客観的な『指摘の事実内容』（What）のみを論理的に抽出すること。",
        "忌避コスト": "失敗やプライドが傷つくことを恐れて行動を避ける心理的コスト。",
        "観の目": "物事の表面的な動きにとらわれず、本質や全体像を俯瞰して観察する視座。",
        "守破離": "日本の武道や芸道の修行プロセス。「守」は基本の型を忠実に守り、「破」は教えを応用・発展させ、「離」は独自の新しいスタイルを確立する。",
        "一拍子": "思考と動作を分離させず、迷いなく対象に向かって最短最速で行動を起こすこと。",
        "形無し": "基本の「型」を習得していない者が、無理に個性を出そうとして失敗すること。",
        "自己流への執着": "人間の能力は生まれつき決まっており努力しても変わらないという思考の癖（固定マインドセット）。",
        "心理的安全性": "チーム内で自分の意見を言ったり失敗したりしても、罰せられたり見下されたりしないという安心感。",
        "自己開示": "自分のプライベートな情報や、弱さや失敗談などをありのままに他者に伝えること。",
        "過剰適応": "他者の期待や指示に応えようとするあまり、自分自身の感情や特性を押し殺してしまう状態。",
        "俯瞰": "自分自身や現在の状況を、まるで空から鳥が地上を見るように高い視点から客観的に把握すること。",
        "パーパス": "自分は何のためにそれをするのか、という根本的な「存在意義」や「目的」。",
        "空（くう）": "一切の執着や先入観を手放し、心が澄み切った状態。",
        "空なり": "一切の執着や先入観を手放し、心が澄み切った状態。"
    };

    let currentBgClass = "bg-evening"; // Default starting bg for chapters
    const out = [{ command: "change_bg", args: currentBgClass }];
    const lines = text.split('\n');

    lines.forEach(line => {
        line = line.trim();
        if(!line || line.startsWith('# ') || line === '＜完＞' || line === '＜本当の完＞') return;

        let newBg = currentBgClass;
        if (line.includes("夜") || line.includes("自室") || line.startsWith("## 補講") || line.includes("深夜")) {
            newBg = "bg-night";
        } else if (line.includes("教室") || line.includes("学校") || line.includes("朝") || line.includes("昼")) {
            newBg = "bg-day";
        } else if (line.includes("道場") || line.includes("部室") || line.includes("体育館") || line.includes("放課後") || line.includes("夕")) {
            newBg = "bg-evening";
        }

        if (newBg !== currentBgClass) {
            currentBgClass = newBg;
            out.push({ command: "change_bg", args: currentBgClass });
        }

        if (line.startsWith('---')) {
            out.push({ command: "scene_break" });
            return;
        }
        if (line.startsWith('## ')) {
            out.push({ command: "title_card", args: line.substring(3).trim() });
            return;
        }

        let speaker = "語り手"; // Default speaker
        let isDialogue = false;
        let dialogueText = line;
        let command = "";
        let args = "";
        
        const knownSpeakers = ["翔太", "高橋先輩", "武蔵", "健太", "陸", "佐藤先生", ""];
        
        for (const sp of knownSpeakers) {
            if (line.startsWith(sp + "「") || line.startsWith(sp + "『")) {
                isDialogue = true;
                speaker = sp;
                line = line.substring(sp.length); // Remove speaker name from text to render
                break;
            }
        }

        if (!isDialogue && (line.startsWith("「") || line.startsWith("『"))) {
            isDialogue = true;
            speaker = ""; // Unnamed dialogue
        }

        if (line.includes("モノクローム") || line.includes("色が消え") || line.includes("色が失い")) { command = "monochrome"; args = "on"; }
        else if(line.includes("色が戻り") || line.includes("色が戻った") || line.includes("時間が動き出した")) { command = "monochrome"; args = "off"; }
        else if(line.includes("パーァァ") || line.includes("パーンッ")) { command = "flash"; }
        else if(line.includes("眼光") || line.includes("怒声") || line.includes("空間がビリビリと")) { command = "shake"; }

        let chunks = line.split('。');
        chunks.forEach((chunk, index) => {
            let textChunk = chunk.trim();
            if (!textChunk) return;
            if (index < chunks.length - 1 || line.endsWith('。')) {
                textChunk += '。';
            }
            
            // Apply Markdown formatting
            textChunk = textChunk.replace(/\*\*(.*?)\*\*/g, '<span class="markdown-bold">$1</span>');
            if (index === 0 && textChunk.startsWith('* ')) {
                textChunk = '<span class="markdown-bullet">・</span>' + textChunk.substring(2);
            }

            // Apply tips safely per sentence chunk
            for (const [word, info] of Object.entries(tips)) {
                if (textChunk.includes(word) && !textChunk.includes("<tip")) {
                    textChunk = textChunk.replace(word, `<tip info="${info}">${word}</tip>`);
                }
            }
            out.push({
                speaker: speaker,
                text: textChunk,
                command: index === 0 ? command : "",
                args: index === 0 ? args : ""
            });
        });
    });
    return out;
}

async function startGame(chapterId) {
    currentChapterId = chapterId;
    
    try {
        let mdFile = chapterId.replace('_', '.') + '.md';
        let titleCase = mdFile.charAt(0).toUpperCase() + mdFile.slice(1);
        const res = await fetch('../ultimate/' + titleCase);
        if (!res.ok) throw new Error('Markdown load failed');
        const text = await res.text();
        gameScenario = parseMarkdownToScenario(text);
    } catch (e) {
        console.error(e);
        alert("Failed to load scenario data for " + chapterId);
        return;
    }
    
    menuScreen.style.display = 'none';
    gameScreen.style.display = 'block';
    
    // Clean state
    document.body.className = '';
    document.getElementById('game-container').className = '';
    effectLayer.innerHTML = '';
    tooltipContainer.classList.remove('show');
    backlogScreen.style.display = 'none';
    currentIndex = 0;
    renderLine();
}

function handleAdvance(e) {
    if (e) {
        if(e.target.classList.contains('tooltip-word')) return;
        // User interacted manually, so turn off auto mode unless they clicked auto btn
        if (isAutoMode && e.target.id !== 'auto-btn') {
            isAutoMode = false;
            autoBtn.classList.remove('active');
            clearTimeout(autoAdvanceTimeout);
        }
    }

    if (isTyping) {
        isTyping = false;
        clearInterval(currentTextInterval);
        const lineData = gameScenario[currentIndex];
        textBox.innerHTML = parseInlineCommands(lineData.text || "");
        bindTooltips();
        clickIndicator.style.display = 'block';
    } else {
        currentIndex++;
        if (currentIndex < gameScenario.length) {
            renderLine();
        } else {
            // Reached End of Chapter
            let cIndex = CHAPTER_ORDER.indexOf(currentChapterId);
            let progressStr = localStorage.getItem(SAVE_KEY);
            let currentUnlocked = progressStr ? parseInt(progressStr) : 0;
            
            // Unlock next chapter
            if (cIndex + 1 > currentUnlocked) {
                localStorage.setItem(SAVE_KEY, cIndex + 1);
            }
            showMenu();
        }
    }
}

function renderLine() {
    isTyping = true;
    clickIndicator.style.display = 'none';
    tooltipContainer.classList.remove('show');
    textBox.innerHTML = '';
    
    const lineData = gameScenario[currentIndex];
    
    if (lineData.speaker && lineData.speaker !== '語り手') {
        speakerName.textContent = lineData.speaker;
        speakerName.className = lineData.speaker === '高橋先輩' || lineData.speaker === '佐藤先生' ? 'sub-character' : lineData.speaker;
    } else {
        speakerName.textContent = '';
        speakerName.className = '';
    }
    
    let waitMs = 0;
    if (lineData.command) {
        waitMs = executeCommand(lineData.command, lineData.args) || 0;
    }
    
    if (!lineData.text) {
        isTyping = false;
        if (waitMs > 0) {
            interactionArea.style.pointerEvents = 'none';
            autoAdvanceTimeout = setTimeout(() => {
                interactionArea.style.pointerEvents = 'auto';
                if (isAutoMode) {
                    autoAdvanceTimeout = setTimeout(() => handleAdvance(), 500);
                } else {
                    handleAdvance(null);
                }
            }, waitMs);
        } else {
            if (isAutoMode) {
                autoAdvanceTimeout = setTimeout(() => handleAdvance(), 100);
            } else {
                handleAdvance();
            }
        }
        return;
    }

    const parsedHTML = parseInlineCommands(lineData.text);
    typeWriterHTML(parsedHTML);
}

function typeWriterHTML(htmlStr) {
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = htmlStr;
    let chars = [];
    
    function traverse(node) {
        if (node.nodeType === 3) {
            const text = node.textContent;
            for(let i=0; i<text.length; i++) chars.push({ textNode: node, char: text[i] });
            node.textContent = '';
        } else {
            for (let child of node.childNodes) traverse(child);
        }
    }
    traverse(tempDiv);
    
    textBox.appendChild(tempDiv);
    
    let i = 0;
    currentTextInterval = setInterval(() => {
        if (i < chars.length) {
            chars[i].textNode.textContent += chars[i].char;
            i++;
        } else {
            clearInterval(currentTextInterval);
            isTyping = false;
            clickIndicator.style.display = 'block';
            bindTooltips();
            if (isAutoMode) {
                autoAdvanceTimeout = setTimeout(() => handleAdvance(), 1500);
            }
        }
    }, 40); 
}

function parseInlineCommands(text) {
    let parsed = text.replace(/<red>(.*?)<\/red>/g, '<span class="highlight-red">$1</span>');
    parsed = parsed.replace(/<blue>(.*?)<\/blue>/g, '<span class="highlight-blue">$1</span>');
    parsed = parsed.replace(/<gold>(.*?)<\/gold>/g, '<span style="color:#ffd700; text-shadow:0 0 10px #ffd700; font-weight:bold;">$1</span>');
    parsed = parsed.replace(/<silver>(.*?)<\/silver>/g, '<span style="color:#e0e0e0; text-shadow:0 0 10px #ffffff; font-weight:bold;">$1</span>');
    parsed = parsed.replace(/<clear>(.*?)<\/clear>/g, '<span style="color:#ffffff; text-shadow:0 0 15px rgba(255,255,255,0.8), 0 0 30px rgba(255,255,255,0.5); font-weight:bold;">$1</span>');
    parsed = parsed.replace(/<tip info="(.*?)">(.*?)<\/tip>/g, '<span class="tooltip-word" data-info="$1">$2</span>');
    return parsed;
}

function bindTooltips() {
    const tips = textBox.querySelectorAll('.tooltip-word');
    tips.forEach(tip => {
        tip.addEventListener('click', (e) => {
            e.stopPropagation(); 
            const info = e.target.getAttribute('data-info');
            const word = e.target.textContent;
            
            tooltipContainer.innerHTML = `<div style="font-weight:bold; font-size:1.2rem; color:#ffcc00; margin-bottom:8px;">${word}</div><div style="font-size:1rem;">${info}</div>`;
            const gameRect = document.getElementById('game-container').getBoundingClientRect();
            let tooltipX = gameRect.width / 2 - 160; 
            let tooltipY = 20; 
            
            tooltipContainer.style.left = tooltipX + 'px';
            tooltipContainer.style.top = tooltipY + 'px';
            tooltipContainer.classList.add('show');
        });
    });
}

function executeCommand(command, args) {
    switch(command) {
        case 'change_bg':
            const bgLayer = document.getElementById('bg-layer');
            if (bgLayer) {
                bgLayer.className = '';
                if (args) bgLayer.classList.add(args);
            }
            return 0;
        case 'monochrome':
            if (args === 'on') document.body.classList.add('state-monochrome');
            else document.body.classList.remove('state-monochrome');
            return 0;
        case 'scene_break':
            const sbEl = document.createElement('div');
            sbEl.className = 'effect-scene-break';
            effectLayer.appendChild(sbEl);
            setTimeout(() => sbEl.remove(), 1500);
            return 1500;
        case 'title_card':
            const tcEl = document.createElement('div');
            tcEl.className = 'effect-title-card';
            tcEl.textContent = args;
            effectLayer.appendChild(tcEl);
            setTimeout(() => tcEl.remove(), 3500);
            return 3500;
        case 'flood_emotions':
            const defaultEmotions = ['怖い', '失敗', 'ムカつく', '言い訳', 'どうせ俺には', '才能がない'];
            triggerFloodEmotions(Array.isArray(args) ? args : defaultEmotions);
            return 0;
        case 'shake':
            const gameContainer = document.getElementById('game-container');
            gameContainer.classList.remove('effect-shake');
            void gameContainer.offsetWidth; // trigger reflow
            gameContainer.classList.add('effect-shake');
            return 0;
        case 'flash':
            const flashEl = document.createElement('div');
            flashEl.className = 'effect-flash';
            effectLayer.appendChild(flashEl);
            setTimeout(() => flashEl.remove(), 600);
            return 600;
    }
    return 0;
}

function triggerFloodEmotions(words) {
    for (let i = 0; i < 20; i++) {
        setTimeout(() => {
            const el = document.createElement('div');
            el.className = 'floating-text';
            el.textContent = words[Math.floor(Math.random() * words.length)];
            el.style.left = (Math.random() * 90) + '%';
            el.style.fontSize = (Math.random() * 2 + 1.5) + 'rem';
            effectLayer.appendChild(el);
            setTimeout(() => el.remove(), 5500); 
        }, Math.random() * 3000); 
    }
}

window.addEventListener('DOMContentLoaded', () => {
    initSystem();
});
