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
        if (lineData.speaker) {
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

function startGame(chapterId) {
    if (!scenarios[chapterId]) {
        alert("This chapter scenario data is not loaded yet!");
        return;
    }
    currentChapterId = chapterId;
    gameScenario = scenarios[chapterId];
    
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
    
    if (lineData.speaker) {
        speakerName.textContent = lineData.speaker;
        speakerName.className = lineData.speaker === '高橋先輩' || lineData.speaker === '佐藤先生' ? 'sub-character' : lineData.speaker;
    } else {
        speakerName.textContent = '';
        speakerName.className = '';
    }
    
    if (lineData.command) {
        executeCommand(lineData.command, lineData.args);
    }
    
    if (!lineData.text) {
        isTyping = false;
        if (isAutoMode) {
            autoAdvanceTimeout = setTimeout(() => handleAdvance(), 100);
        } else {
            handleAdvance();
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
            for(let i=0; i<text.length; i++) chars.push({ parent: node.parentNode, char: text[i] });
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
            chars[i].parent.textContent += chars[i].char;
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
        case 'monochrome':
            if (args === 'on') document.body.classList.add('state-monochrome');
            else document.body.classList.remove('state-monochrome');
            break;
        case 'flood_emotions':
            const defaultEmotions = ['怖い', '失敗', 'ムカつく', '言い訳', 'どうせ俺には', '才能がない'];
            triggerFloodEmotions(Array.isArray(args) ? args : defaultEmotions);
            break;
        case 'shake':
            const gameContainer = document.getElementById('game-container');
            gameContainer.classList.remove('effect-shake');
            void gameContainer.offsetWidth; // trigger reflow
            gameContainer.classList.add('effect-shake');
            break;
        case 'flash':
            const flashEl = document.createElement('div');
            flashEl.className = 'effect-flash';
            effectLayer.appendChild(flashEl);
            setTimeout(() => flashEl.remove(), 600);
            break;
    }
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
