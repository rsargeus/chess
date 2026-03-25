import { Board } from './board';
import * as api from './api';
import { initAuth, isAuthenticated, getUser, loginWithGoogle, loginWithEmailPassword, logout } from './auth';
import { playMove, playCapture, playCheck, playGameOver, unlockAudio, playLobbyMusic, stopLobbyMusic, toggleMute, isMuted, isLobbyPlaying } from './sound';
import type { UserProfileData } from './api';
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
let moveRecords: api.MoveRecord[] = [];
let viewIndex = 0;
let currentPlayerColor: 'w' | 'b' | null = null; // null = not multiplayer

const INITIAL_FEN = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';

const loginScreenEl  = document.getElementById('login-screen')!;
const appEl          = document.getElementById('app')!;
const loginGoogleBtns = document.querySelectorAll<HTMLElement>('.js-login-google');
const loginEmailBtns  = document.querySelectorAll<HTMLElement>('.js-login-email');
const userNameEl     = document.getElementById('user-name')!;
const logoutBtn      = document.getElementById('logout-btn')!;
const premiumBadgeEl = document.getElementById('premium-badge')!;

const boardEl        = document.getElementById('board')!;
const statusEl       = document.getElementById('status')!;
const moveListEl     = document.getElementById('move-list')!;
const gameListEl     = document.getElementById('game-list') as HTMLDivElement;
const newGameBtn     = document.getElementById('new-game-btn')!;
const resignBtn      = document.getElementById('resign-btn')!;
const navBackBtn     = document.getElementById('nav-back-btn')!;
const navFwdBtn      = document.getElementById('nav-fwd-btn')!;
const capturedPiecesEl  = document.getElementById('captured-pieces')!;
const capturedByWhiteEl = document.getElementById('captured-by-white')!;
const capturedByBlackEl = document.getElementById('captured-by-black')!;

const wakeupBannerEl = document.getElementById('wakeup-banner')!;
const profileCardEl      = document.getElementById('profile-card')!;
const profileNameEl      = document.getElementById('profile-name')!;
const profileRankEl      = document.getElementById('profile-rank')!;
const profileStatGamesEl = document.getElementById('profile-stat-games')!;
const profileAvatarEl    = document.querySelector('#profile-card .profile-avatar') as HTMLElement;
const profileModalEl     = document.getElementById('profile-modal')!;
const profileNameInput   = document.getElementById('profile-name-input') as HTMLInputElement;
const profileSaveBtn     = document.getElementById('profile-save-btn')!;
const profileCancelBtn   = document.getElementById('profile-cancel-btn')!;
const previewAvatarEl    = document.getElementById('preview-avatar')!;
const previewNameEl      = document.getElementById('preview-name')!;
const muteBtn      = document.getElementById('mute-btn')!;
const muteIconOn   = document.getElementById('mute-icon-on')!;
const muteIconOff  = document.getElementById('mute-icon-off')!;

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
  stopLobbyMusic();
  hideProfileCard();
  muteBtn.classList.add('hidden');
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
  board.setFen(state.fen, interactive, isFlipped(), null);
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
  stopLobbyMusic();
  hideProfileCard();
  muteBtn.classList.add('hidden');
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
  board.setFen(state.fen, interactive, isFlipped(), lastMoveOf(state.moves));
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
    board!.setFen(state.fen, interactive, isFlipped(), lastMoveOf(state.moves));
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
    const optimistic = board!.applyMoveOptimistically(from, to);
    if (optimistic?.captured) playCapture(); else playMove();
    statusEl.textContent = 'Thinking…';

    const result = await api.postMove(currentGameId, from, to);
    const active = ['active', 'check'].includes(result.status);

    if (result.computerMove) {
      board!.setFen(result.move.fenAfter, false, isFlipped(), { from: result.move.from, to: result.move.to });
      await new Promise(r => setTimeout(r, 1000));
      // Computer move sound
      if (result.computerMove.san.includes('x')) playCapture();
      else playMove();
    }

    const finalLastMove = result.computerMove
      ? { from: result.computerMove.from, to: result.computerMove.to }
      : { from: result.move.from, to: result.move.to };
    board!.setFen(result.fen, active, isFlipped(), finalLastMove);
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
    board!.setFen(state.fen, true, isFlipped(), lastMoveOf(state.moves));
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
    : (isComputer ? `AI (${LEVELS[level ?? 5]})` : 'Black to move');

  const statusMap: Record<string, string> = {
    active: turnLabel,
    check: isComputer && turn === 'w' ? 'You are in check' : isComputer ? 'AI is in check' : `${turn === 'w' ? 'White' : 'Black'} is in check`,
    checkmate: 'Checkmate!',
    stalemate: 'Stalemate — draw',
    draw: 'Draw',
    resigned: 'Resigned',
  };
  statusEl.textContent = statusMap[status] ?? status;
}

function lastMoveOf(moves: api.MoveRecord[]): { from: string; to: string } | null {
  return moves.length > 0 ? { from: moves[moves.length - 1].from, to: moves[moves.length - 1].to } : null;
}

function setMoveHistory(moves: api.MoveRecord[]): void {
  moveHistory = [INITIAL_FEN, ...moves.map(m => m.fenAfter)];
  moveRecords = moves;
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
  const navLastMove = viewIndex > 0 ? { from: moveRecords[viewIndex - 1].from, to: moveRecords[viewIndex - 1].to } : null;
  board!.setFen(moveHistory[viewIndex], isLatest && gameIsActive, isFlipped(), navLastMove);
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
  showProfileCard(userNameEl.textContent ?? '');
  muteBtn.classList.remove('hidden');
  playLobbyMusic();
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

function rankFromGames(count: number): string {
  if (count >= 51) return 'Veteran';
  if (count >= 31) return 'Club Player';
  if (count >= 16) return 'Casual';
  if (count >= 6)  return 'Apprentice';
  return 'Beginner';
}

async function updateProfileCard(name: string): Promise<void> {
  profileNameEl.textContent = name;
  const allGames = await api.listGames().catch(() => []);
  const count = allGames.length;
  profileStatGamesEl.textContent = String(count);
  profileRankEl.textContent = rankFromGames(count);
}

function showProfileCard(name: string): void {
  profileCardEl.classList.remove('hidden');
  const p = loadUserProfile();
  profileNameEl.textContent = p.displayName || name;
  applyAvatarToCard(p.piece, p.color);
  updateProfileCard(p.displayName || name);
  // Sync from server in background
  api.getProfile().then(remote => {
    if (!remote) return;
    cacheUserProfile({ ...remote });
    profileNameEl.textContent = remote.displayName || name;
    applyAvatarToCard(remote.piece, remote.color);
  }).catch(() => {});
}

function hideProfileCard(): void {
  profileCardEl.classList.add('hidden');
}

async function refreshGameList(): Promise<void> {
  const allGames = await api.listGames();
  const games = showActiveOnly
    ? allGames.filter(g => ['active', 'check'].includes(g.status))
    : allGames;
  const ICON_EARTH = `<svg width="18" height="18" viewBox="0 0 32 32" fill="none"><defs><radialGradient id="eg" cx="0.4" cy="0.38" r="0.65" gradientUnits="objectBoundingBox"><stop offset="0%" stop-color="#4a6878"/><stop offset="100%" stop-color="#263848"/></radialGradient></defs><circle cx="16" cy="16" r="15" fill="url(#eg)"/><g transform="rotate(-23.5,16,16)"><path d="M5 10 C7 8 12 9 13 12 C14 15 11 18 10 20 C8 21 5 20 5 17 C4 14 4 12 5 10Z" fill="#4a5e48"/><path d="M10 22 C12 21 14 23 13 27 C12 30 9 31 8 28 C7 25 8 23 10 22Z" fill="#4a5e48"/><path d="M19 8 C22 7 25 9 24 13 C23 16 21 15 20 18 C19 21 20 25 18 27 C16 29 15 27 16 24 C17 21 16 18 18 14 C19 12 18 10 19 8Z" fill="#4a5e48"/><ellipse cx="16" cy="3.5" rx="6" ry="2.5" fill="rgba(255,255,255,0.72)"/><ellipse cx="16" cy="28.5" rx="4" ry="2" fill="rgba(255,255,255,0.5)"/></g><circle cx="16" cy="16" r="15" stroke="rgba(255,255,255,0.18)" stroke-width="0.5"/></svg>`;
  const ICON_HELM = `<svg width="18" height="21" viewBox="0 0 32 38" fill="none"><defs><linearGradient id="hg" x1="0" y1="0" x2="1" y2="0" gradientUnits="objectBoundingBox"><stop offset="0%" stop-color="#141e28"/><stop offset="30%" stop-color="#283848"/><stop offset="55%" stop-color="#1e2c3a"/><stop offset="80%" stop-color="#283848"/><stop offset="100%" stop-color="#141e28"/></linearGradient><linearGradient id="hgg" x1="0" y1="0" x2="0" y2="1" gradientUnits="objectBoundingBox"><stop offset="0%" stop-color="#dea83a"/><stop offset="60%" stop-color="#c8922a"/><stop offset="100%" stop-color="#9a6e18"/></linearGradient></defs><path d="M6 14 C6 5 26 5 26 14" fill="#1a2430"/><rect x="5" y="13" width="22" height="21" rx="2" fill="url(#hg)"/><path d="M5 29 L5 34 Q5 36 7 36 L25 36 Q27 36 27 34 L27 29 Z" fill="url(#hg)"/><rect x="7" y="14" width="2.5" height="18" rx="1.25" fill="rgba(255,255,255,0.07)"/><rect x="5" y="12" width="22" height="3.5" fill="url(#hgg)"/><circle cx="8.5" cy="13.8" r="1" fill="#f0d060"/><circle cx="16" cy="13.8" r="1" fill="#f0d060"/><circle cx="23.5" cy="13.8" r="1" fill="#f0d060"/><rect x="15" y="17" width="2" height="5.5" rx="1" fill="#c8922a"/><rect x="11.5" y="18.5" width="9" height="1.8" rx="0.9" fill="#c8922a"/><path d="M16 16 L17.2 17.5 L16 18.3 L14.8 17.5 Z" fill="#daa830"/><circle cx="11" cy="19.4" r="1.3" fill="#c8922a"/><circle cx="21" cy="19.4" r="1.3" fill="#c8922a"/><path d="M16 22.5 L17 21.8 L16 23.5 L15 21.8 Z" fill="#c8922a"/><rect x="5" y="24" width="22" height="2.5" fill="url(#hgg)"/><rect x="6" y="26.5" width="20" height="2.5" rx="0.8" fill="#060c12"/><rect x="5" y="29" width="22" height="2.5" fill="url(#hgg)"/><rect x="15" y="24" width="2" height="7.5" fill="#daa830"/><circle cx="8" cy="30.3" r="0.9" fill="#f0d060"/><circle cx="24" cy="30.3" r="0.9" fill="#f0d060"/></svg>`;
  const ICON_PVP = `<svg width="18" height="18" viewBox="0 0 32 32" fill="none"><path d="M0 32 Q0 22 9 21 Q18 22 18 32Z" fill="#2a2a30"/><path d="M3.5 13 C3.5 5 14.5 5 14.5 13 C14.5 18.5 12 21.5 9 21.5 C6 21.5 3.5 18.5 3.5 13Z" fill="#525660"/><ellipse cx="9" cy="12.5" rx="3.2" ry="3.8" fill="#c8a068"/><path d="M5.5 9.2 Q9 7.5 12.5 9.2" stroke="#c8922a" stroke-width="0.8" fill="none" stroke-linecap="round"/><path d="M14 32 Q14 22 23 21 Q32 22 32 32Z" fill="#343438"/><path d="M17.5 13 C17.5 5 28.5 5 28.5 13 C28.5 18.5 26 21.5 23 21.5 C20 21.5 17.5 18.5 17.5 13Z" fill="#646870"/><ellipse cx="23" cy="12.5" rx="3.2" ry="3.8" fill="#c8a068"/><path d="M19.5 9.2 Q23 7.5 26.5 9.2" stroke="#c8922a" stroke-width="0.8" fill="none" stroke-linecap="round"/></svg>`;

  function modeIcon(g: GameSummary): string {
    if (g.mode === 'vs_computer') return ICON_HELM;
    if ((g.mode as string) === 'multiplayer') return ICON_EARTH;
    return ICON_PVP;
  }

  function opponentLabel(g: GameSummary): string {
    if (g.mode === 'vs_computer') return `AI Level ${g.computerLevel}`;
    if ((g.mode as string) === 'multiplayer') {
      if (g.waitingForOpponent) return 'Invite sent…';
      return g.playerColor === 'w' ? 'Playing as White' : 'Playing as Black';
    }
    return 'Local Game';
  }

  function formatDate(iso: string): string {
    const d = new Date(iso);
    const now = new Date();
    const diffDays = Math.floor((now.getTime() - d.getTime()) / 86400000);
    if (diffDays === 0) return 'Today';
    if (diffDays === 1) return 'Yesterday';
    return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
  }

  const isFinished = (s: string) => ['checkmate', 'stalemate', 'resigned', 'draw'].includes(s);
  const isActive   = (s: string) => ['active', 'check'].includes(s);

  function isYourTurn(g: GameSummary): boolean {
    if (!isActive(g.status)) return false;
    if (g.mode === 'vs_computer' || g.mode === 'pvp') return true;
    if (g.waitingForOpponent) return false;
    return g.playerColor === g.turn;
  }

  function makeBadge(g: GameSummary): string {
    if (g.waitingForOpponent) return `<span class="game-badge waiting">Waiting for opponent</span>`;
    if (isFinished(g.status)) {
      const label = g.status === 'checkmate' ? 'Checkmate' : g.status === 'resigned' ? 'Resigned' : g.status === 'stalemate' ? 'Stalemate' : 'Draw';
      return `<span class="game-badge done">${label} · ${g.moveCount} moves</span>`;
    }
    if (isYourTurn(g)) return `<span class="turn-dot green"></span><span class="game-badge your-turn">Your turn</span>`;
    return `<span class="turn-dot grey"></span><span class="game-badge their-turn">Their turn</span>`;
  }

  function makeCard(g: GameSummary): HTMLElement {
    const div = document.createElement('div');
    div.className = 'game-card' + (g.gameId === currentGameId ? ' active-game' : '');
    div.innerHTML = `
      <div class="mode-icon-sm">${modeIcon(g)}</div>
      <div class="card-body">
        <div class="card-top">
          <span class="card-opponent">${opponentLabel(g)}</span>
          <span class="card-date">${formatDate(g.createdAt)}</span>
        </div>
        <div class="card-bottom">
          ${makeBadge(g)}
          ${!isFinished(g.status) && !g.waitingForOpponent ? `<span class="card-moves">${g.moveCount} moves</span>` : ''}
        </div>
      </div>`;
    div.addEventListener('click', () => { loadGame(g.gameId); closeSidebar(); });
    return div;
  }

  function addSection(label: string, items: GameSummary[]) {
    if (!items.length) return;
    const header = document.createElement('div');
    header.className = 'section-header';
    header.textContent = label;
    gameListEl.appendChild(header);
    items.forEach(g => gameListEl.appendChild(makeCard(g)));
  }

  gameListEl.innerHTML = '';
  const yourTurn  = games.filter(g => isActive(g.status) && isYourTurn(g));
  const waiting   = games.filter(g => (isActive(g.status) && !isYourTurn(g)) || g.waitingForOpponent);
  const finished  = games.filter(g => isFinished(g.status));
  addSection('Your turn', yourTurn);
  addSection('Waiting', waiting);
  addSection('Finished', finished);
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
loginGoogleBtns.forEach(btn => btn.addEventListener('click', async () => {
  try { await loginWithGoogle(); } catch { return; }
  await showApp();
}));
loginEmailBtns.forEach(btn => btn.addEventListener('click', async () => {
  try { await loginWithEmailPassword(); } catch { return; }
  await showApp();
}));

// Mobile onboarding: update dots on swipe
const loginSlidesEl = document.getElementById('login-slides');
if (loginSlidesEl) {
  loginSlidesEl.addEventListener('scroll', () => {
    const index = Math.round(loginSlidesEl.scrollLeft / loginSlidesEl.clientWidth);
    loginSlidesEl.querySelectorAll('.login-slide').forEach(slide => {
      slide.querySelectorAll('.slide-dot').forEach((dot, di) => {
        dot.classList.toggle('active', di === index);
      });
    });
  }, { passive: true });
}
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

// ── Backend wake-up probe ────────────────────────────────────────────────────
let _progressInterval: ReturnType<typeof setInterval> | null = null;
let _progressPct = 0;

function _updateProgress(pct: number): void {
  const fill = document.getElementById('progress-fill') as HTMLElement | null;
  const label = document.getElementById('progress-pct') as HTMLElement | null;
  if (fill)  fill.style.width = pct + '%';
  if (label) label.textContent = Math.round(pct) + '%';
}

function _startProgress(): void {
  _progressPct = 0;
  _updateProgress(0);
  _progressInterval = setInterval(() => {
    const step = _progressPct < 60 ? 1.8 : _progressPct < 85 ? 0.7 : 0.2;
    _progressPct = Math.min(95, _progressPct + step);
    _updateProgress(_progressPct);
  }, 500);
}

function _stopProgress(): void {
  if (_progressInterval) { clearInterval(_progressInterval); _progressInterval = null; }
}

function showGameListSkeleton(): void {
  const row = () => `<div class="skel-card">
    <div class="skel skel-icon"></div>
    <div class="skel-lines">
      <div class="skel skel-t" style="width:65%"></div>
      <div class="skel skel-s" style="width:40%"></div>
    </div>
  </div>`;
  gameListEl.innerHTML = row() + row() + row();
}

async function probeBackend(): Promise<void> {
  showGameListSkeleton();

  // Show banner after 3 s if the backend hasn't responded yet
  // (Render free tier queues requests instead of rejecting them)
  let bannerShown = false;
  const bannerTimer = setTimeout(() => {
    bannerShown = true;
    wakeupBannerEl.classList.remove('hidden');
    newGameBtn.setAttribute('disabled', 'true');
    _startProgress();
  }, 3000);

  try {
    await api.pingBackend(); // may hang ~30 s on cold start
    clearTimeout(bannerTimer);
  } catch {
    clearTimeout(bannerTimer);
    // Actual failure — ensure banner is visible and retry
    if (!bannerShown) {
      bannerShown = true;
      wakeupBannerEl.classList.remove('hidden');
      newGameBtn.setAttribute('disabled', 'true');
      _startProgress();
    }
    const deadline = Date.now() + 60_000;
    let serverReady = false;
    while (Date.now() < deadline) {
      await new Promise<void>(r => setTimeout(r, 3000));
      try { await api.pingBackend(); serverReady = true; break; } catch { /* keep waiting */ }
    }

    if (!serverReady) {
      _stopProgress();
      wakeupBannerEl.classList.add('banner-error');
      const textEl = wakeupBannerEl.querySelector('.banner-text') as HTMLElement;
      if (textEl) textEl.innerHTML = 'Server unavailable. Try refreshing.';
      const spinnerEl = wakeupBannerEl.querySelector('.banner-spinner') as HTMLElement;
      if (spinnerEl) spinnerEl.style.display = 'none';
      const progressEl = wakeupBannerEl.querySelector('.banner-progress-wrap') as HTMLElement;
      if (progressEl) progressEl.style.display = 'none';
      return; // leave banner visible, button stays disabled
    }
  }

  if (bannerShown) {
    _stopProgress();
    wakeupBannerEl.classList.add('hidden');
    newGameBtn.removeAttribute('disabled');
  }
}
// ─────────────────────────────────────────────────────────────────────────────

async function showApp(paymentSuccess = false): Promise<void> {
  loginScreenEl.classList.add('hidden');
  appEl.classList.remove('hidden');
  const user = await getUser();
  const displayName = user ? (user.name ?? user.email ?? '') : '';
  if (user) {
    userNameEl.textContent = displayName;
  }

  showProfileCard(displayName);
  muteBtn.classList.remove('hidden');
  playLobbyMusic();
  await probeBackend();

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

// Unlock AudioContext on first interaction (required on iOS Safari)
document.addEventListener('pointerdown', unlockAudio, { once: true, capture: true });
document.addEventListener('touchstart',  unlockAudio, { once: true, capture: true });

function updateMuteBtn(): void {
  const off = isMuted() || !isLobbyPlaying();
  muteBtn.classList.toggle('muted', off);
  muteIconOn.classList.toggle('hidden', off);
  muteIconOff.classList.toggle('hidden', !off);
}

muteBtn.addEventListener('click', () => {
  if (!isMuted() && !isLobbyPlaying()) {
    // Blocked by browser — this click is a gesture, use it to start music
    playLobbyMusic();
  } else {
    toggleMute();
  }
  updateMuteBtn();
});
document.addEventListener('lobby-music-started', updateMuteBtn);
updateMuteBtn();

// ── Profile ───────────────────────────────────────────────────────────────────

const AVATAR_PIECES: Record<string, string> = {
  king: '♔', queen: '♕', rook: '♖', bishop: '♗', knight: '♘', pawn: '♙',
};

const COLOR_GRADIENTS: Record<string, string> = {
  brown:  'linear-gradient(135deg,#2e1a08,#1a1008)',
  green:  'linear-gradient(135deg,#1a3a1a,#0d1a0d)',
  navy:   'linear-gradient(135deg,#1a1a3a,#0d0d22)',
  purple: 'linear-gradient(135deg,#2e1a2e,#1a0d1a)',
  forest: 'linear-gradient(135deg,#1e2e1a,#101a0d)',
  wine:   'linear-gradient(135deg,#3a1a1a,#1a0d0d)',
  teal:   'linear-gradient(135deg,#1a2e2e,#0d1818)',
  slate:  'linear-gradient(135deg,#262630,#141418)',
};

interface UserProfile { displayName: string; piece: string; color: string; }

function loadUserProfile(): UserProfile {
  try {
    const raw = localStorage.getItem('userProfile');
    if (raw) return JSON.parse(raw);
  } catch {}
  return { displayName: '', piece: 'queen', color: 'brown' };
}

function cacheUserProfile(p: UserProfile): void {
  localStorage.setItem('userProfile', JSON.stringify(p));
}

function applyAvatarToCard(piece: string, color: string): void {
  profileAvatarEl.textContent = AVATAR_PIECES[piece] ?? '♕';
  profileAvatarEl.style.background = COLOR_GRADIENTS[color] ?? COLOR_GRADIENTS['brown'];
}

// Wire edit buttons (desktop icon + mobile text)
document.querySelectorAll('.profile-edit-btn').forEach(btn => {
  btn.addEventListener('click', () => openProfileModal());
});

function openProfileModal(): void {
  const p = loadUserProfile();
  profileNameInput.value = p.displayName;
  selectPiece(p.piece);
  selectColor(p.color);
  updatePreview();
  profileSaveBtn.textContent = 'Save';
  profileSaveBtn.removeAttribute('disabled');
  profileModalEl.classList.remove('hidden');
}

let modalPiece = 'queen';
let modalColor = 'brown';

function selectPiece(piece: string): void {
  modalPiece = piece;
  profileModalEl.querySelectorAll<HTMLElement>('.piece-option').forEach(el => {
    el.classList.toggle('selected', el.dataset.piece === piece);
  });
  updatePreview();
}

function selectColor(color: string): void {
  modalColor = color;
  profileModalEl.querySelectorAll<HTMLElement>('.color-swatch').forEach(el => {
    el.classList.toggle('selected', el.dataset.color === color);
  });
  updatePreview();
}

function updatePreview(): void {
  previewAvatarEl.textContent = PIECE_SYMBOLS[modalPiece] ?? '♕';
  previewAvatarEl.style.background = COLOR_GRADIENTS[modalColor] ?? COLOR_GRADIENTS['brown'];
  previewNameEl.textContent = profileNameInput.value.trim() || '—';
}

profileModalEl.querySelectorAll<HTMLElement>('.piece-option').forEach(el => {
  el.addEventListener('click', () => selectPiece(el.dataset.piece!));
});
profileModalEl.querySelectorAll<HTMLElement>('.color-swatch').forEach(el => {
  el.addEventListener('click', () => selectColor(el.dataset.color!));
});
profileNameInput.addEventListener('input', updatePreview);

profileSaveBtn.addEventListener('click', async () => {
  const name = profileNameInput.value.trim();
  const p: UserProfile = { displayName: name, piece: modalPiece, color: modalColor };
  profileSaveBtn.textContent = 'Saving…';
  profileSaveBtn.setAttribute('disabled', 'true');
  try {
    await api.saveProfile(p as UserProfileData);
    cacheUserProfile(p);
    applyAvatarToCard(p.piece, p.color);
    if (name) profileNameEl.textContent = name;
    profileModalEl.classList.add('hidden');
  } catch (err) {
    console.error('Failed to save profile:', err);
    profileSaveBtn.textContent = 'Save failed — retry';
    profileSaveBtn.removeAttribute('disabled');
  }
});

profileCancelBtn.addEventListener('click', () => profileModalEl.classList.add('hidden'));
profileModalEl.addEventListener('click', (e) => {
  if (e.target === profileModalEl) profileModalEl.classList.add('hidden');
});

// Apply saved profile on load
(function initProfile() {
  const p = loadUserProfile();
  applyAvatarToCard(p.piece, p.color);
})();

boot();
