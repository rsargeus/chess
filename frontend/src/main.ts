import { Board } from './board';
import * as api from './api';
import { initAuth, isAuthenticated, getUser, loginWithGoogle, loginWithEmailPassword, logout } from './auth';
import { playMove, playCapture, playCheck, playGameOver } from './sound';
import { connectToGame, disconnectFromGame } from './ws-client';

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
let currentPlayerColor: 'w' | 'b' | null = null; // null = not multiplayer

const INITIAL_FEN = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';

const loginScreenEl  = document.getElementById('login-screen')!;
const appEl          = document.getElementById('app')!;
const loginGoogleBtn = document.getElementById('login-google-btn')!;
const loginEmailBtn  = document.getElementById('login-email-btn')!;
const userNameEl     = document.getElementById('user-name')!;
const logoutBtn      = document.getElementById('logout-btn')!;
const premiumBadgeEl = document.getElementById('premium-badge')!;

const boardEl        = document.getElementById('board')!;
const statusEl       = document.getElementById('status')!;
const moveListEl     = document.getElementById('move-list')!;
const gameListEl     = document.getElementById('game-list')!;
const newGameBtn     = document.getElementById('new-game-btn')!;
const resignBtn      = document.getElementById('resign-btn')!;
const navBackBtn     = document.getElementById('nav-back-btn')!;
const navFwdBtn      = document.getElementById('nav-fwd-btn')!;
const capturedPiecesEl  = document.getElementById('captured-pieces')!;
const capturedByWhiteEl = document.getElementById('captured-by-white')!;
const capturedByBlackEl = document.getElementById('captured-by-black')!;

const overlayEl      = document.getElementById('overlay')!;
const overlayMsg     = document.getElementById('overlay-msg')!;
const overlayNewGame = document.getElementById('overlay-new-game')!;

// Mode modal elements
const modeModalEl = document.getElementById('mode-modal')!;
const modePvpBtn = document.getElementById('mode-pvp-btn')!;
const modeComputerBtn = document.getElementById('mode-computer-btn')!;
const modeMultiplayerBtn = document.getElementById('mode-multiplayer-btn')!;
const modeCancelBtn = document.getElementById('mode-cancel-btn')!;

// Invite modal elements
const inviteModalEl = document.getElementById('invite-modal')!;
const inviteLinkBox = document.getElementById('invite-link-box')!;
const inviteCopyBtn = document.getElementById('invite-copy-btn')!;
const inviteCloseBtn = document.getElementById('invite-close-btn')!;

// Payment modal elements
const paymentModalEl = document.getElementById('payment-modal')!;
const paymentPayBtn = document.getElementById('payment-pay-btn')!;
const paymentCancelBtn = document.getElementById('payment-cancel-btn')!;

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

function showModeModal(): Promise<'pvp' | 'computer' | 'multiplayer' | null> {
  return new Promise((resolve) => {
    modeModalEl.classList.remove('hidden');
    const cleanup = (r: 'pvp' | 'computer' | 'multiplayer' | null) => {
      modeModalEl.classList.add('hidden');
      modePvpBtn.removeEventListener('click', onPvp);
      modeComputerBtn.removeEventListener('click', onComputer);
      modeMultiplayerBtn.removeEventListener('click', onMultiplayer);
      modeCancelBtn.removeEventListener('click', onCancel);
      resolve(r);
    };
    const onPvp = () => cleanup('pvp');
    const onComputer = () => cleanup('computer');
    const onMultiplayer = () => cleanup('multiplayer');
    const onCancel = () => cleanup(null);
    modePvpBtn.addEventListener('click', onPvp);
    modeComputerBtn.addEventListener('click', onComputer);
    modeMultiplayerBtn.addEventListener('click', onMultiplayer);
    modeCancelBtn.addEventListener('click', onCancel);
  });
}

function showInviteModal(inviteCode: string): void {
  const url = `${window.location.origin}?join=${inviteCode}`;
  inviteLinkBox.textContent = url;
  inviteModalEl.classList.remove('hidden');

  const onCopy = async () => {
    await navigator.clipboard.writeText(url).catch(() => {});
    inviteCopyBtn.textContent = 'Copied!';
    setTimeout(() => { inviteCopyBtn.textContent = 'Copy Link'; }, 2000);
  };
  const onClose = () => {
    inviteModalEl.classList.add('hidden');
    inviteCopyBtn.removeEventListener('click', onCopy);
    inviteCloseBtn.removeEventListener('click', onClose);
  };
  inviteCopyBtn.addEventListener('click', onCopy);
  inviteCloseBtn.addEventListener('click', onClose);
}

function showPaymentModal(): Promise<boolean> {
  return new Promise((resolve) => {
    paymentModalEl.classList.remove('hidden');
    const cleanup = (r: boolean) => {
      paymentModalEl.classList.add('hidden');
      paymentPayBtn.removeEventListener('click', onPay);
      paymentCancelBtn.removeEventListener('click', onCancel);
      resolve(r);
    };
    const onPay = async () => {
      paymentPayBtn.textContent = 'Loading…';
      paymentPayBtn.setAttribute('disabled', 'true');
      try {
        const url = await api.createCheckoutSession();
        window.location.href = url;
      } catch {
        paymentPayBtn.textContent = 'Pay 20 kr';
        paymentPayBtn.removeAttribute('disabled');
      }
    };
    const onCancel = () => cleanup(false);
    paymentPayBtn.addEventListener('click', onPay);
    paymentCancelBtn.addEventListener('click', onCancel);
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

  if (modeChoice === 'multiplayer') {
    const state = await api.createGame('multiplayer');
    beginGame(state);
    if (state.inviteCode) showInviteModal(state.inviteCode);
    return;
  }

  // vs computer — check premium membership
  const me = await api.getMe();
  if (!me.premium) {
    await showPaymentModal();
    return;
  }

  // pick level
  const level = await showLevelModal();
  if (level === -1 || level === null) {
    if (level === null) startNewGame();
    return;
  }

  const state = await api.createGame('vs_computer', level);
  beginGame(state);
}

function isMyTurn(turn: 'w' | 'b', mode: api.GameMode, waitingForOpponent: boolean): boolean {
  if (mode !== 'multiplayer') return true;
  if (waitingForOpponent) return false;
  return currentPlayerColor === turn;
}

function isFlipped(): boolean {
  return currentPlayerColor === 'b';
}

function beginGame(state: api.GameState): void {
  currentGameId = state.gameId;
  currentPlayerColor = state.playerColor ?? null;
  gameIsActive = true;
  overlayEl.classList.add('hidden');
  boardEl.parentElement!.classList.remove('empty');
  resignBtn.classList.remove('hidden');
  moveListEl.classList.remove('hidden');
  newGameBtn.classList.add('hidden');
  lobbyBtn.classList.remove('hidden');
  board = new Board(boardEl, handleMove);
  const interactive = isMyTurn(state.turn, state.mode, state.waitingForOpponent);
  board.setFen(state.fen, interactive, isFlipped());
  setMoveHistory([]);
  navBackBtn.classList.remove('hidden');
  navFwdBtn.classList.remove('hidden');
  updateStatus(state.status, state.turn, state.mode, state.computerLevel, state.waitingForOpponent);
  renderMoveList([]);
  updateCapturedPieces(state.fen);
  refreshGameList();
  if (state.mode === 'multiplayer') {
    connectToGame(state.gameId, handleWsEvent);
  }
}

async function loadGame(gameId: string): Promise<void> {
  const state = await api.getGame(gameId);
  currentGameId = state.gameId;
  currentPlayerColor = state.playerColor ?? null;
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
  const interactive = active && isMyTurn(state.turn, state.mode, state.waitingForOpponent);
  board.setFen(state.fen, interactive, isFlipped());
  setMoveHistory(state.moves);
  navBackBtn.classList.remove('hidden');
  navFwdBtn.classList.remove('hidden');
  updateStatus(state.status, state.turn, state.mode, state.computerLevel, state.waitingForOpponent);
  renderMoveList(state.moves);
  updateCapturedPieces(state.fen);
  if (state.mode === 'multiplayer') {
    connectToGame(state.gameId, handleWsEvent);
  }
}

async function handleWsEvent(event: { type: string; gameId: string }): Promise<void> {
  if (event.gameId !== currentGameId) return;
  if (event.type === 'move' || event.type === 'opponent_joined' || event.type === 'resigned') {
    const state = await api.getGame(currentGameId!);
    const active = ['active', 'check'].includes(state.status);
    gameIsActive = active;
    const interactive = active && isMyTurn(state.turn, state.mode, state.waitingForOpponent);
    board!.setFen(state.fen, interactive, isFlipped());
    updateCapturedPieces(state.fen);
    setMoveHistory(state.moves);
    updateStatus(state.status, state.turn, state.mode, state.computerLevel, state.waitingForOpponent);
    renderMoveList(state.moves);
    if (event.type === 'move') {
      playMove();
    }
    if (!active) {
      playGameOver();
      showOverlay(state.status);
    }
    refreshGameList();
  }
}

async function handleMove(from: string, to: string): Promise<void> {
  if (!currentGameId) return;
  try {
    board!.setFen(board!.getCurrentFen(), false, isFlipped());
    statusEl.textContent = 'Thinking…';

    const result = await api.postMove(currentGameId, from, to);
    const active = ['active', 'check'].includes(result.status);

    // Player move sound
    if (result.move.san.includes('x')) playCapture();
    else playMove();

    if (result.computerMove) {
      board!.setFen(result.move.fenAfter, false, isFlipped());
      await new Promise(r => setTimeout(r, 1000));
      // Computer move sound
      if (result.computerMove.san.includes('x')) playCapture();
      else playMove();
    }

    board!.setFen(result.fen, active, isFlipped());
    updateCapturedPieces(result.fen);

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
    board!.setFen(state.fen, true, isFlipped());
    updateStatus(state.status, state.turn, state.mode, state.computerLevel);
    statusEl.textContent = err.message;
  }
}

function updateStatus(status: string, turn: string, mode: api.GameMode, level: number | null, waitingForOpponent = false): void {
  if (mode === 'multiplayer') {
    if (waitingForOpponent) { statusEl.textContent = 'Waiting for opponent…'; return; }
    const myTurn = currentPlayerColor === turn;
    const statusMap: Record<string, string> = {
      active: myTurn ? 'Your turn' : "Opponent's turn",
      check: myTurn ? 'You are in check!' : 'Opponent is in check',
      checkmate: 'Checkmate!',
      stalemate: 'Stalemate — draw',
      draw: 'Draw',
      resigned: 'Resigned',
    };
    statusEl.textContent = statusMap[status] ?? status;
    return;
  }

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
  board!.setFen(moveHistory[viewIndex], isLatest && gameIsActive, isFlipped());
  updateNavButtons();
  highlightMoveInList(viewIndex - 1); // viewIndex 0 = before any moves
  updateCapturedPieces(moveHistory[viewIndex]);
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

const PIECE_SYMBOLS: Record<string, string> = {
  P: '♙', N: '♘', B: '♗', R: '♖', Q: '♕',
  p: '♟', n: '♞', b: '♝', r: '♜', q: '♛',
};
const PIECE_ORDER = ['Q', 'R', 'B', 'N', 'P'];
const PIECE_VALUES: Record<string, number> = { Q: 9, R: 5, B: 3, N: 3, P: 1 };
const START_COUNTS: Record<string, number> = { P: 8, N: 2, B: 2, R: 2, Q: 1, p: 8, n: 2, b: 2, r: 2, q: 1 };

function updateCapturedPieces(fen: string): void {
  const boardFen = fen.split(' ')[0];
  const onBoard: Record<string, number> = {};
  for (const ch of boardFen) {
    if (/[pnbrqkPNBRQK]/.test(ch)) onBoard[ch] = (onBoard[ch] ?? 0) + 1;
  }

  // White captures = missing black pieces (lowercase)
  const capturedByWhite = PIECE_ORDER.map(p => p.toLowerCase())
    .flatMap(p => Array(Math.max(0, (START_COUNTS[p] ?? 0) - (onBoard[p] ?? 0))).fill(PIECE_SYMBOLS[p]))
    .filter(Boolean);

  // Black captures = missing white pieces (uppercase)
  const capturedByBlack = PIECE_ORDER
    .flatMap(p => Array(Math.max(0, (START_COUNTS[p] ?? 0) - (onBoard[p] ?? 0))).fill(PIECE_SYMBOLS[p]))
    .filter(Boolean);

  // Calculate point totals
  const scoreWhite = PIECE_ORDER.map(p => p.toLowerCase())
    .reduce((sum, p) => sum + Math.max(0, (START_COUNTS[p] ?? 0) - (onBoard[p] ?? 0)) * PIECE_VALUES[p.toUpperCase()], 0);
  const scoreBlack = PIECE_ORDER
    .reduce((sum, p) => sum + Math.max(0, (START_COUNTS[p] ?? 0) - (onBoard[p] ?? 0)) * PIECE_VALUES[p], 0);

  const diff = scoreWhite - scoreBlack;
  const whiteScore = diff > 0 ? `<span class="captured-score">+${diff}</span>` : '';
  const blackScore = diff < 0 ? `<span class="captured-score">+${-diff}</span>` : '';

  capturedByWhiteEl.innerHTML = capturedByWhite.map(s => `<span class="captured-piece">${s}</span>`).join('') + whiteScore;
  capturedByBlackEl.innerHTML = capturedByBlack.map(s => `<span class="captured-piece">${s}</span>`).join('') + blackScore;

  const hasAny = capturedByWhite.length > 0 || capturedByBlack.length > 0;
  capturedPiecesEl.classList.toggle('hidden', !hasAny);
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
  disconnectFromGame();
  currentGameId = null;
  currentPlayerColor = null;
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
  capturedPiecesEl.classList.add('hidden');
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
    let modeLabel: string;
    if (g.mode === 'vs_computer') modeLabel = `vs CPU Lvl ${g.computerLevel}`;
    else if (g.mode === 'multiplayer') modeLabel = g.waitingForOpponent ? '🌐 Waiting…' : `🌐 ${g.playerColor === 'w' ? 'White' : 'Black'}`;
    else modeLabel = '2P';
    li.textContent = `${date} · ${modeLabel} · ${g.status} (${g.moveCount})`;
    li.addEventListener('click', () => { loadGame(g.gameId); closeSidebar(); });
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

// Mobile sidebar toggle
const sidebarEl = document.querySelector('.sidebar')!;
const sidebarOverlayEl = document.getElementById('sidebar-overlay')!;
const sidebarToggleBtn = document.getElementById('sidebar-toggle-btn')!;
function closeSidebar() {
  sidebarEl.classList.remove('open');
  sidebarOverlayEl.classList.remove('open');
}
sidebarToggleBtn.addEventListener('click', () => {
  const isOpen = sidebarEl.classList.toggle('open');
  sidebarOverlayEl.classList.toggle('open', isOpen);
});
sidebarOverlayEl.addEventListener('click', closeSidebar);
loginGoogleBtn.addEventListener('click', () => loginWithGoogle());
loginEmailBtn.addEventListener('click', () => loginWithEmailPassword());
logoutBtn.addEventListener('click', () => logout());

async function boot(): Promise<void> {
  try {
    await initAuth();
    if (await isAuthenticated()) {
      const params = new URLSearchParams(window.location.search);
      const paymentSuccess = params.get('payment') === 'success';
      const joinCode = params.get('join');
      history.replaceState({}, '', window.location.pathname);
      await showApp(paymentSuccess);
      if (joinCode) {
        try {
          const state = await api.joinGame(joinCode);
          beginGame(state);
        } catch (e: any) {
          statusEl.textContent = e.message ?? 'Failed to join game';
        }
      }
      return;
    }
    // Not authenticated — save join code so we redirect back after login
    const joinCode = new URLSearchParams(window.location.search).get('join');
    if (joinCode) sessionStorage.setItem('pendingJoin', joinCode);
  } catch (e) {
    console.error('Auth init error:', e);
  }
  loginScreenEl.classList.remove('hidden');
}

async function showApp(paymentSuccess = false): Promise<void> {
  loginScreenEl.classList.add('hidden');
  appEl.classList.remove('hidden');
  const user = await getUser();
  if (user) {
    userNameEl.textContent = user.name ?? user.email ?? '';
  }
  const me = await api.getMe().catch(() => ({ premium: false }));
  premiumBadgeEl.classList.toggle('hidden', !me.premium);
  if (paymentSuccess) {
    const banner = document.getElementById('payment-banner')!;
    banner.classList.remove('hidden');
    if (!me.premium) {
      await pollForPremium();
    }
    setTimeout(() => banner.classList.add('hidden'), 5000);
  }
  refreshGameList();

  // Handle pending join from before login
  const pendingJoin = sessionStorage.getItem('pendingJoin');
  if (pendingJoin) {
    sessionStorage.removeItem('pendingJoin');
    try {
      const state = await api.joinGame(pendingJoin);
      beginGame(state);
    } catch (e: any) {
      statusEl.textContent = e.message ?? 'Failed to join game';
    }
  }
}

async function pollForPremium(): Promise<void> {
  const maxAttempts = 10;
  const intervalMs = 2000;
  for (let i = 0; i < maxAttempts; i++) {
    await new Promise(r => setTimeout(r, intervalMs));
    const me = await api.getMe().catch(() => ({ premium: false }));
    if (me.premium) {
      premiumBadgeEl.classList.remove('hidden');
      return;
    }
  }
}

boot();
