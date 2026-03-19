import { Board } from './board';
import * as api from './api';
import { initAuth, isAuthenticated, getUser, loginWithGoogle, loginWithEmailPassword, logout } from './auth';
import { playMove, playCapture, playCheck, playGameOver } from './sound';

const LEVELS: Record<number, string> = {
  1: 'Beginner',
  2: 'Novice',
  3: 'Casual',
  4: 'Intermediate',
  5: 'Club Player',
  6: 'Advanced',
  7: 'Expert',
  8: 'Master',
  9: 'Int. Master',
  10: 'Grandmaster',
};

let currentGameId: string | null = null;
let board: Board | null = null;
let showActiveOnly = true;
let gameIsActive = false;
let moveHistory: string[] = [];
let viewIndex = 0;

const INITIAL_FEN = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';

const loginScreenEl  = document.getElementById('login-screen')!;
const appEl          = document.getElementById('app')!;
const loginGoogleBtn = document.getElementById('login-google-btn')!;
const loginEmailBtn  = document.getElementById('login-email-btn')!;
const userNameEl     = document.getElementById('user-name')!;
const logoutBtn      = document.getElementById('logout-btn')!;

const boardEl        = document.getElementById('board')!;
const statusEl       = document.getElementById('status')!;
const moveListEl     = document.getElementById('move-list')!;
const gameListEl     = document.getElementById('game-list')!;
const newGameBtn     = document.getElementById('new-game-btn')!;
const resignBtn      = document.getElementById('resign-btn')!;
const navBackBtn     = document.getElementById('nav-back-btn')!;
const navFwdBtn      = document.getElementById('nav-fwd-btn')!;
const overlayEl      = document.getElementById('overlay')!;
const overlayMsg     = document.getElementById('overlay-msg')!;
const overlayNewGame = document.getElementById('overlay-new-game')!;

// Mode modal elements
const modeModalEl = document.getElementById('mode-modal')!;
const modePvpBtn = document.getElementById('mode-pvp-btn')!;
const modeComputerBtn = document.getElementById('mode-computer-btn')!;
const modeCancelBtn = document.getElementById('mode-cancel-btn')!;

// Level modal elements
const levelModalEl = document.getElementById('level-modal')!;
const levelBackBtn = document.getElementById('level-back-btn')!;
const levelCancelBtn = document.getElementById('level-cancel-btn')!;
const levelSlider = document.getElementById('level-slider') as HTMLInputElement;
const levelLabel = document.getElementById('level-label')!;
const levelName = document.getElementById('level-name')!;
const levelStartBtn = document.getElementById('level-start-btn')!;

// Update level label live as slider moves
levelSlider.addEventListener('input', () => {
  const v = parseInt(levelSlider.value);
  levelLabel.textContent = String(v);
  levelName.textContent = LEVELS[v];
});

function showModeModal(): Promise<'pvp' | 'computer' | null> {
  return new Promise((resolve) => {
    modeModalEl.classList.remove('hidden');
    const cleanup = (r: 'pvp' | 'computer' | null) => {
      modeModalEl.classList.add('hidden');
      modePvpBtn.removeEventListener('click', onPvp);
      modeComputerBtn.removeEventListener('click', onComputer);
      modeCancelBtn.removeEventListener('click', onCancel);
      resolve(r);
    };
    const onPvp = () => cleanup('pvp');
    const onComputer = () => cleanup('computer');
    const onCancel = () => cleanup(null);
    modePvpBtn.addEventListener('click', onPvp);
    modeComputerBtn.addEventListener('click', onComputer);
    modeCancelBtn.addEventListener('click', onCancel);
  });
}

function showLevelModal(): Promise<number | null> {
  return new Promise((resolve) => {
    // Reset to default level 5
    levelSlider.value = '5';
    levelLabel.textContent = '5';
    levelName.textContent = LEVELS[5];

    levelModalEl.classList.remove('hidden');
    const cleanup = (r: number | null) => {
      levelModalEl.classList.add('hidden');
      levelStartBtn.removeEventListener('click', onStart);
      levelBackBtn.removeEventListener('click', onBack);
      levelCancelBtn.removeEventListener('click', onCancel);
      resolve(r);
    };
    const onStart = () => cleanup(parseInt(levelSlider.value));
    const onBack = () => cleanup(null); // null = go back
    const onCancel = () => cleanup(-1); // -1 = full cancel
    levelStartBtn.addEventListener('click', onStart);
    levelBackBtn.addEventListener('click', onBack);
    levelCancelBtn.addEventListener('click', onCancel);
  });
}

async function startNewGame(): Promise<void> {
  const modeChoice = await showModeModal();
  if (modeChoice === null) return;

  if (modeChoice === 'pvp') {
    const state = await api.createGame('pvp');
    beginGame(state);
    return;
  }

  // vs computer — pick level
  const level = await showLevelModal();
  if (level === -1 || level === null) {
    // -1 = cancel, null = back → re-show mode modal
    if (level === null) startNewGame();
    return;
  }

  const state = await api.createGame('vs_computer', level);
  beginGame(state);
}

function beginGame(state: api.GameState): void {
  currentGameId = state.gameId;
  gameIsActive = true;
  overlayEl.classList.add('hidden');
  boardEl.parentElement!.classList.remove('empty');
  resignBtn.classList.remove('hidden');
  moveListEl.classList.remove('hidden');
  newGameBtn.classList.add('hidden');
  lobbyBtn.classList.remove('hidden');
  board = new Board(boardEl, handleMove);
  board.setFen(state.fen, true);
  setMoveHistory([]);
  navBackBtn.classList.remove('hidden');
  navFwdBtn.classList.remove('hidden');
  updateStatus(state.status, state.turn, state.mode, state.computerLevel);
  renderMoveList([]);
  refreshGameList();
}

async function loadGame(gameId: string): Promise<void> {
  const state = await api.getGame(gameId);
  currentGameId = state.gameId;
  overlayEl.classList.add('hidden');
  boardEl.parentElement!.classList.remove('empty');
  const active = ['active', 'check'].includes(state.status);
  gameIsActive = active;
  if (active) {
    resignBtn.classList.remove('hidden');
    newGameBtn.classList.add('hidden');
  } else {
    resignBtn.classList.add('hidden');
    newGameBtn.classList.remove('hidden');
  }
  lobbyBtn.classList.remove('hidden');
  moveListEl.classList.remove('hidden');
  board = new Board(boardEl, handleMove);
  board.setFen(state.fen, active);
  setMoveHistory(state.moves);
  navBackBtn.classList.remove('hidden');
  navFwdBtn.classList.remove('hidden');
  updateStatus(state.status, state.turn, state.mode, state.computerLevel);
  renderMoveList(state.moves);
}

async function handleMove(from: string, to: string): Promise<void> {
  if (!currentGameId) return;
  try {
    board!.setFen(board!.getCurrentFen(), false);
    statusEl.textContent = 'Thinking…';

    const result = await api.postMove(currentGameId, from, to);
    const active = ['active', 'check'].includes(result.status);

    // Player move sound
    if (result.move.san.includes('x')) playCapture();
    else playMove();

    if (result.computerMove) {
      board!.setFen(result.move.fenAfter, false);
      await new Promise(r => setTimeout(r, 1000));
      // Computer move sound
      if (result.computerMove.san.includes('x')) playCapture();
      else playMove();
    }

    board!.setFen(result.fen, active);

    const state = await api.getGame(currentGameId);
    gameIsActive = active;
    setMoveHistory(state.moves);
    updateStatus(result.status, result.turn, state.mode, state.computerLevel);
    renderMoveList(state.moves);

    if (!['active', 'check'].includes(result.status)) {
      gameIsActive = false;
      playGameOver();
      showOverlay(result.status);
    } else if (result.status === 'check') {
      playCheck();
    }
    refreshGameList();
  } catch (err: any) {
    const state = await api.getGame(currentGameId!);
    board!.setFen(state.fen, true);
    updateStatus(state.status, state.turn, state.mode, state.computerLevel);
    statusEl.textContent = err.message;
  }
}

function updateStatus(status: string, turn: string, mode: api.GameMode, level: number | null): void {
  const isComputer = mode === 'vs_computer';
  const turnLabel = turn === 'w'
    ? (isComputer ? 'Your turn' : 'White to move')
    : (isComputer ? `Computer (${LEVELS[level ?? 5]})` : 'Black to move');

  const statusMap: Record<string, string> = {
    active: turnLabel,
    check: isComputer && turn === 'w' ? 'You are in check' : isComputer ? 'Computer is in check' : `${turn === 'w' ? 'White' : 'Black'} is in check`,
    checkmate: 'Checkmate!',
    stalemate: 'Stalemate — draw',
    draw: 'Draw',
    resigned: 'Resigned',
  };
  statusEl.textContent = statusMap[status] ?? status;
}

function setMoveHistory(moves: api.MoveRecord[]): void {
  moveHistory = [INITIAL_FEN, ...moves.map(m => m.fenAfter)];
  viewIndex = moveHistory.length - 1;
  updateNavButtons();
}

function updateNavButtons(): void {
  navBackBtn.disabled = viewIndex <= 0;
  navFwdBtn.disabled = viewIndex >= moveHistory.length - 1;
}

function navigateTo(index: number): void {
  if (index < 0 || index >= moveHistory.length) return;
  viewIndex = index;
  const isLatest = viewIndex === moveHistory.length - 1;
  board!.setFen(moveHistory[viewIndex], isLatest && gameIsActive);
  updateNavButtons();
  highlightMoveInList(viewIndex - 1); // viewIndex 0 = before any moves
}

function highlightMoveInList(moveIdx: number): void {
  const spans = moveListEl.querySelectorAll<HTMLElement>('.move-san');
  spans.forEach((s, i) => s.classList.toggle('move-current', i === moveIdx));
}

function renderMoveList(moves: api.MoveRecord[]): void {
  moveListEl.innerHTML = '';
  for (let i = 0; i < moves.length; i += 2) {
    const row = document.createElement('div');
    row.className = 'move-row';
    const num = document.createElement('span');
    num.className = 'move-num';
    num.textContent = `${Math.floor(i / 2) + 1}.`;
    const w = document.createElement('span');
    w.className = 'move-san';
    w.textContent = moves[i].san;
    const b = document.createElement('span');
    b.className = 'move-san';
    b.textContent = moves[i + 1]?.san ?? '';
    row.append(num, w, b);
    moveListEl.appendChild(row);
  }
  moveListEl.scrollTop = moveListEl.scrollHeight;
}

function showOverlay(status: string): void {
  const messages: Record<string, string> = {
    checkmate: 'Checkmate!',
    stalemate: "Stalemate — it's a draw",
    draw: 'Draw',
    resigned: 'Game resigned',
  };
  overlayMsg.textContent = messages[status] ?? 'Game over';
  overlayNewGame.textContent = 'Quit';
  overlayEl.classList.remove('hidden');
}

function returnToStart(): void {
  currentGameId = null;
  board = null;
  overlayEl.classList.add('hidden');
  boardEl.parentElement!.classList.add('empty');
  resignBtn.classList.add('hidden');
  newGameBtn.classList.remove('hidden');
  lobbyBtn.classList.add('hidden');
  navBackBtn.classList.add('hidden');
  navFwdBtn.classList.add('hidden');
  statusEl.textContent = '';
  moveListEl.innerHTML = '';
  moveListEl.classList.add('hidden');
}

async function refreshGameList(): Promise<void> {
  const allGames = await api.listGames();
  const games = showActiveOnly
    ? allGames.filter(g => ['active', 'check'].includes(g.status))
    : allGames;
  gameListEl.innerHTML = '';
  for (const g of games) {
    const li = document.createElement('li');
    li.className = 'game-item' + (g.gameId === currentGameId ? ' active-game' : '');
    const date = new Date(g.createdAt).toLocaleDateString();
    const modeLabel = g.mode === 'vs_computer'
      ? `vs CPU Lvl ${g.computerLevel}`
      : '2P';
    li.textContent = `${date} · ${modeLabel} · ${g.status} (${g.moveCount})`;
    li.addEventListener('click', () => loadGame(g.gameId));
    gameListEl.appendChild(li);
  }
}

const activeFilterBtn = document.getElementById('active-filter-btn')!;
activeFilterBtn.classList.add('active');
activeFilterBtn.addEventListener('click', () => {
  showActiveOnly = !showActiveOnly;
  activeFilterBtn.classList.toggle('active', showActiveOnly);
  refreshGameList();
});

newGameBtn.addEventListener('click', startNewGame);
overlayNewGame.addEventListener('click', returnToStart);
resignBtn.addEventListener('click', async () => {
  if (!currentGameId) return;
  await api.resignGame(currentGameId);
  showOverlay('resigned');
  refreshGameList();
});

const lobbyBtn = document.getElementById('lobby-btn')!;
lobbyBtn.classList.add('hidden');
lobbyBtn.addEventListener('click', returnToStart);

navBackBtn.classList.add('hidden');
navFwdBtn.classList.add('hidden');
navBackBtn.addEventListener('click', () => navigateTo(viewIndex - 1));
navFwdBtn.addEventListener('click', () => navigateTo(viewIndex + 1));
loginGoogleBtn.addEventListener('click', () => loginWithGoogle());
loginEmailBtn.addEventListener('click', () => loginWithEmailPassword());
logoutBtn.addEventListener('click', () => logout());

async function boot(): Promise<void> {
  try {
    await initAuth();
    if (await isAuthenticated()) {
      showApp();
      return;
    }
  } catch (e) {
    console.error('Auth init error:', e);
  }
  loginScreenEl.classList.remove('hidden');
}

async function showApp(): Promise<void> {
  loginScreenEl.classList.add('hidden');
  appEl.classList.remove('hidden');
  const user = await getUser();
  if (user) {
    userNameEl.textContent = user.name ?? user.email ?? '';
  }
  refreshGameList();
}

boot();
