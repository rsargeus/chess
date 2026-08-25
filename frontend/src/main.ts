import { Board } from './board';
import * as api from './api';
import { initAuth, isAuthenticated, getUser, loginWithGoogle, loginWithEmailPassword, logout } from './auth';
import { playMove, playCapture, playCheck, playGameOver, unlockAudio, playLobbyMusic, stopLobbyMusic, toggleMute, isMuted, isLobbyPlaying } from './sound';
import type { UserProfileData } from './api';
import { connectToGame, disconnectFromGame } from './ws-client';
import { OPENINGS, detectOpening } from './openings';
import type { Opening, OpeningLine } from './openings';
import { TrainingSession, OpeningExploreSession, GlobalExploreSession } from './training';

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
let currentMode: api.GameMode | null = null;
let submittingMove = false;
let pendingOpeningMoves: { from: string; to: string }[] = [];

const INITIAL_FEN = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';

const loginScreenEl  = document.getElementById('login-screen')!;
const appEl          = document.getElementById('app')!;
const loginGoogleBtns = document.querySelectorAll<HTMLElement>('.js-login-google');
const loginEmailBtns  = document.querySelectorAll<HTMLElement>('.js-login-email');
const userNameEl     = document.getElementById('user-name')!;
const logoutBtn      = document.getElementById('logout-btn')!;
const premiumBadgeEl = document.getElementById('profile-premium-badge')!;

const boardEl        = document.getElementById('board')!;
const statusEl       = document.getElementById('status')!;
const moveListEl     = document.getElementById('move-list')!;
const gameListEl     = document.getElementById('game-list') as HTMLDivElement;
const newGameBtn     = document.getElementById('new-game-btn')!;
const trainingBtn    = document.getElementById('training-btn') as HTMLButtonElement;
const resignBtn      = document.getElementById('resign-btn')!;
const playFromBtn    = document.getElementById('play-from-btn') as HTMLButtonElement;;
const navBackBtn     = document.getElementById('nav-back-btn')!;
const navFwdBtn      = document.getElementById('nav-fwd-btn')!;
const capturedPiecesEl  = document.getElementById('captured-pieces')!;
const capturedByWhiteEl = document.getElementById('captured-by-white')!;
const capturedByBlackEl = document.getElementById('captured-by-black')!;
const panelEl           = document.querySelector<HTMLElement>('.panel')!;

// Coach panel elements
const coachPanelEl  = document.getElementById('coach-panel')!;
const coachEvalWrapEl = document.getElementById('coach-eval-wrap')!;
const coachEvalFill = document.getElementById('coach-eval-fill') as HTMLElement;
const coachScoreEl  = document.getElementById('coach-score')!;
const coachQualityEl = document.getElementById('coach-quality')!;
const coachPlayerSanEl = document.getElementById('coach-player-san')!;
const coachOppPanelEl = document.getElementById('coach-opp-panel')!;
const coachOppQualityEl = document.getElementById('coach-opp-quality')!;
const coachOppSanEl = document.getElementById('coach-opp-san')!;
const coachOppBestSanEl = document.getElementById('coach-opp-best-san')!;
const undoBtnEl = document.getElementById('undo-btn') as HTMLButtonElement;
const bestPlayBtnEl = document.getElementById('best-play-btn') as HTMLButtonElement;
const evalToggleBtnEl = document.getElementById('eval-toggle-btn') as HTMLButtonElement;
const oppToggleBtnEl = document.getElementById('opp-toggle-btn') as HTMLButtonElement;
const youToggleBtnEl = document.getElementById('you-toggle-btn') as HTMLButtonElement;
const coachOppWrapEl = document.getElementById('coach-opp-wrap')!;
const coachYouWrapEl = document.getElementById('coach-you-wrap')!;
const coachPvEl = document.getElementById('coach-pv')!;
const coachOppPvEl = document.getElementById('coach-opp-pv')!;
const coachMsgEl = document.getElementById('coach-msg')!;
const coachMsgRowEl = document.getElementById('coach-msg-row')!;
const coachAskRowEl = document.getElementById('coach-ask-row')!;
const coachAskBtn = document.getElementById('coach-ask-btn') as HTMLButtonElement;
const coachOppMsgEl = document.getElementById('coach-opp-msg')!;
const coachOppMsgRowEl = document.getElementById('coach-opp-msg-row')!;
const coachOppAskRowEl = document.getElementById('coach-opp-ask-row')!;
const coachOppAskBtn = document.getElementById('coach-opp-ask-btn') as HTMLButtonElement;
const coachSpeakBtn = document.getElementById('coach-speak-btn') as HTMLButtonElement;
const coachOppSpeakBtn = document.getElementById('coach-opp-speak-btn') as HTMLButtonElement;
const coachAltsEl = document.getElementById('coach-alts')!;
const coachOppAltsEl = document.getElementById('coach-opp-alts')!;
const coachPvTextEl = document.getElementById('coach-pv-text')!;
const coachPvPlayBtn = document.getElementById('coach-pv-play') as HTMLButtonElement;
const coachOppPvTextEl = document.getElementById('coach-opp-pv-text')!;
const coachOppPvPlayBtn = document.getElementById('coach-opp-pv-play') as HTMLButtonElement;
const coachBestSanEl = document.getElementById('coach-best-san')!;
const coachSpinnerEl = document.getElementById('coach-spinner')!;

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

const openingLabelEl    = document.getElementById('opening-label')!;
const overlayEl         = document.getElementById('overlay')!;
const overlayMsg        = document.getElementById('overlay-msg')!;
const overlayNewGame    = document.getElementById('overlay-new-game')!;
const overlayOpeningEl   = document.getElementById('overlay-opening')!;
const overlayOpeningText = document.getElementById('overlay-opening-text')!;
const overlayOpeningBtn  = document.getElementById('overlay-opening-btn')!;

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
const promoCodeInput = document.getElementById('promo-code-input') as HTMLInputElement;
const promoCodeError = document.getElementById('promo-code-error')!;

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
  inviteCopyBtn.addEventListener('click', onCopy, { once: true });
  inviteCloseBtn.addEventListener('click', onClose, { once: true });
}

function showPaymentModal(): Promise<boolean> {
  return new Promise((resolve) => {
    paymentModalEl.classList.remove('hidden');
    promoCodeInput.value = '';
    promoCodeError.textContent = '';
    const cleanup = (r: boolean) => {
      paymentModalEl.classList.add('hidden');
      paymentPayBtn.removeEventListener('click', onPay);
      paymentCancelBtn.removeEventListener('click', onCancel);
      resolve(r);
    };
    const onPay = async () => {
      paymentPayBtn.textContent = 'Loading…';
      paymentPayBtn.setAttribute('disabled', 'true');
      promoCodeError.textContent = '';
      try {
        const promoCode = promoCodeInput.value.trim() || undefined;
        const url = await api.createCheckoutSession(promoCode);
        window.location.href = url;
      } catch (err: any) {
        const msg = err?.message || '';
        if (msg.includes('Invalid promotion code')) {
          promoCodeError.textContent = 'Invalid discount code.';
        } else {
          promoCodeError.textContent = 'Something went wrong. Please try again.';
        }
        paymentPayBtn.textContent = 'Pay 200 kr';
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

  const opening = pendingOpeningMoves.length ? [...pendingOpeningMoves] : undefined;
  pendingOpeningMoves = [];
  const state = await api.createGame('vs_computer', level, opening);
  beginGame(state);
}

function isMyTurn(turn: 'w' | 'b', mode: api.GameMode, waitingForOpponent: boolean): boolean {
  if (mode === 'multiplayer') {
    if (waitingForOpponent) return false;
    return currentPlayerColor === turn;
  }
  if (mode === 'vs_computer' && currentPlayerColor !== null) {
    return currentPlayerColor === turn;
  }
  return true;
}

function isFlipped(): boolean {
  return currentPlayerColor === 'b';
}

function setGameUrl(gameId: string): void {
  history.replaceState({}, '', `?game=${gameId}`);
}

function clearGameUrl(): void {
  history.replaceState({}, '', window.location.pathname);
}

function beginGame(state: api.GameState): void {
  stopLobbyMusic();
  hideProfileCard();
  panelEl.classList.remove('hidden');
  showCoachPanel();
  muteBtn.classList.add('hidden');
  currentGameId = state.gameId;
  currentPlayerColor = state.playerColor ?? null;
  currentMode = state.mode;
  setGameUrl(state.gameId);
  gameIsActive = true;
  overlayEl.classList.add('hidden');
  boardEl.parentElement!.classList.remove('empty');
  resignBtn.classList.remove('hidden');
  moveListEl.classList.remove('hidden');
  newGameBtn.classList.add('hidden');
  lobbyBtn.classList.remove('hidden');
  if (state.mode === 'vs_computer') undoBtnEl.classList.remove('hidden');
  else undoBtnEl.classList.add('hidden');
  board = new Board(boardEl, handleMove);
  const interactive = isMyTurn(state.turn, state.mode, state.waitingForOpponent);
  board.setFen(state.fen, interactive, isFlipped(), lastMoveOf(state.moves));
  setMoveHistory(state.moves);
  navBackBtn.classList.remove('hidden');
  navFwdBtn.classList.remove('hidden');
  updateStatus(state.status, state.turn, state.mode, state.computerLevel, state.waitingForOpponent);
  renderMoveList(state.moves);
  if (state.moves.length > 0) highlightMoveInList(state.moves.length - 1);
  updateCapturedPieces(state.fen);
  refreshGameList();
  // Run coach/eval analysis for opening moves (same logic as loadGame)
  if (state.moves.length > 0) {
    let playerLastMoveIdx = -1;
    for (let i = state.moves.length - 1; i >= 0; i--) {
      if ((i % 2 === 0) === (currentPlayerColor === 'w' || currentPlayerColor === null)) {
        playerLastMoveIdx = i; break;
      }
    }
    if (playerLastMoveIdx >= 0) {
      const playerLastMove = state.moves[playerLastMoveIdx];
      const analysisPrevFen = playerLastMoveIdx === 0 ? INITIAL_FEN : state.moves[playerLastMoveIdx - 1].fenAfter;
      runCoachAnalysis(playerLastMove.fenAfter, analysisPrevFen, playerLastMove.san)
        .then(() => { if (playerLastMove.fenAfter !== state.fen) return refreshEvalBar(state.fen); })
        .catch(() => {});
    } else {
      refreshEvalBar(state.fen).catch(() => {});
    }
    if (state.mode === 'vs_computer' && state.moves.length >= 2) {
      const lastMove = state.moves[state.moves.length - 1];
      const prevFen  = state.moves[state.moves.length - 2].fenAfter;
      runOpponentAnalysis(state.fen, prevFen, lastMove.san).catch(() => {});
    }
  }
  if (state.mode === 'multiplayer') {
    connectToGame(state.gameId, handleWsEvent);
  }
}

async function loadGame(gameId: string): Promise<void> {
  stopLobbyMusic();
  hideProfileCard();
  panelEl.classList.remove('hidden');
  showCoachPanel();
  muteBtn.classList.add('hidden');
  const state = await api.getGame(gameId);
  currentGameId = state.gameId;
  currentPlayerColor = state.playerColor ?? null;
  currentMode = state.mode;
  setGameUrl(state.gameId);
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
  if (state.mode === 'vs_computer') {
    undoBtnEl.classList.remove('hidden');
    undoBtnEl.disabled = state.moves.length === 0;
  } else {
    undoBtnEl.classList.add('hidden');
  }
  board = new Board(boardEl, handleMove);
  const interactive = active && isMyTurn(state.turn, state.mode, state.waitingForOpponent);
  board.setFen(state.fen, interactive, isFlipped(), lastMoveOf(state.moves));
  setMoveHistory(state.moves);
  navBackBtn.classList.remove('hidden');
  navFwdBtn.classList.remove('hidden');
  updateStatus(state.status, state.turn, state.mode, state.computerLevel, state.waitingForOpponent);
  renderMoveList(state.moves);
  highlightMoveInList(state.moves.length - 1);
  updateCapturedPieces(state.fen);
  // Find player's last move index for quality analysis
  let playerLastMoveIdx = -1;
  for (let i = state.moves.length - 1; i >= 0; i--) {
    if ((i % 2 === 0) === (currentPlayerColor === 'w' || currentPlayerColor === null)) {
      playerLastMoveIdx = i; break;
    }
  }
  if (playerLastMoveIdx >= 0) {
    const playerLastMove = state.moves[playerLastMoveIdx];
    const analysisPrevFen = playerLastMoveIdx === 0 ? INITIAL_FEN : state.moves[playerLastMoveIdx - 1].fenAfter;
    runCoachAnalysis(playerLastMove.fenAfter, analysisPrevFen, playerLastMove.san)
      .then(() => { if (playerLastMove.fenAfter !== state.fen) return refreshEvalBar(state.fen); })
      .catch(() => {});
  } else {
    refreshEvalBar(state.fen).catch(() => {});
  }
  if (state.mode === 'vs_computer' && state.moves.length >= 2) {
    const lastMove = state.moves[state.moves.length - 1];
    const prevFen  = state.moves[state.moves.length - 2].fenAfter;
    runOpponentAnalysis(state.fen, prevFen, lastMove.san).catch(() => {});
  }
  if (state.mode === 'multiplayer') {
    connectToGame(state.gameId, handleWsEvent);
  }
}

async function handleWsEvent(event: { type: string; gameId: string }): Promise<void> {
  if (event.gameId !== currentGameId) return;
  if (event.type === 'move' || event.type === 'opponent_joined' || event.type === 'resigned') {
    const state = await api.getGame(currentGameId!);
    // Keep playerColor in sync (e.g. after opponent joins)
    if (state.playerColor) currentPlayerColor = state.playerColor;
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
      showOverlay(state.status, state.moves);
    }
    refreshGameList();
  }
}

async function handleMove(from: string, to: string): Promise<void> {
  if (!currentGameId || !board || submittingMove) return;
  submittingMove = true;
  try {
    const optimistic = board.applyMoveOptimistically(from, to);
    if (optimistic?.captured) playCapture(); else playMove();
    statusEl.textContent = 'Thinking…';

    const result = await api.postMove(currentGameId, from, to);
    const active = ['active', 'check'].includes(result.status);

    if (result.computerMove) {
      board.setFen(result.move.fenAfter, false, isFlipped(), { from: result.move.from, to: result.move.to });
      await new Promise(r => setTimeout(r, 1000));
      // Computer move sound
      if (result.computerMove.san.includes('x')) playCapture();
      else playMove();
    }

    const finalLastMove = result.computerMove
      ? { from: result.computerMove.from, to: result.computerMove.to }
      : { from: result.move.from, to: result.move.to };
    board.setFen(result.fen, active, isFlipped(), finalLastMove);
    updateCapturedPieces(result.fen);

    const state = await api.getGame(currentGameId);
    gameIsActive = active;
    setMoveHistory(state.moves);
    updateStatus(result.status, result.turn, state.mode, state.computerLevel);
    renderMoveList(state.moves);

    if (!['active', 'check'].includes(result.status)) {
      gameIsActive = false;
      playGameOver();
      showOverlay(result.status, state.moves);
    } else if (result.status === 'check') {
      playCheck();
    }
    refreshGameList();

    // Coach analysis — always analyse the player's own move, not the computer's response.
    // If the computer replied, result.fen is after the computer's move; use result.move.fenAfter
    // (the position right after the player moved) and the FEN one step further back as previous.
    const hasComputerReply = !!result.computerMove;
    const analysisFen     = hasComputerReply ? result.move.fenAfter : result.fen;
    const analysisPrevFen = moveHistory[moveHistory.length - 2 - (hasComputerReply ? 1 : 0)];
    // Analyse player's move (quality + best alternative), then update coach for final position
    // Player move quality + eval update after computer reply — run in parallel
    const playerAnalysis = runCoachAnalysis(analysisFen, analysisPrevFen, result.move.san)
      .then(() => { if (hasComputerReply) return refreshEvalBar(result.fen); });
    const oppAnalysis = hasComputerReply && result.computerMove
      ? runOpponentAnalysis(result.fen, result.move.fenAfter, result.computerMove.san)
      : Promise.resolve();
    Promise.all([playerAnalysis, oppAnalysis]).catch(() => {});

    if (currentMode === 'vs_computer') undoBtnEl.disabled = false;
  } catch (err: any) {
    try {
      const state = await api.getGame(currentGameId!);
      if (board) {
        board.setFen(state.fen, true, isFlipped(), lastMoveOf(state.moves));
        updateStatus(state.status, state.turn, state.mode, state.computerLevel);
      }
    } catch {
      // If recovery fetch also fails, just show the original error
    }
    statusEl.textContent = err.message;
  } finally {
    submittingMove = false;
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
  const isPlayerTurn = isComputer && currentPlayerColor !== null
    ? currentPlayerColor === turn
    : turn === 'w';
  const turnLabel = isComputer
    ? (isPlayerTurn ? 'Your turn' : `AI (${LEVELS[level ?? 5]})`)
    : (turn === 'w' ? 'White to move' : 'Black to move');

  const statusMap: Record<string, string> = {
    active: turnLabel,
    check: isComputer
      ? (isPlayerTurn ? 'You are in check' : 'AI is in check')
      : `${turn === 'w' ? 'White' : 'Black'} is in check`,
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

// ── Coach panel ──────────────────────────────────────────────
// Eval bar toggle — persisted in localStorage
let evalBarVisible = localStorage.getItem('evalBarVisible') !== 'false';
function applyEvalBarVisibility(): void {
  if (evalBarVisible) {
    coachEvalWrapEl.classList.remove('hidden');
    evalToggleBtnEl.classList.add('active');
  } else {
    coachEvalWrapEl.classList.add('hidden');
    evalToggleBtnEl.classList.remove('active');
  }
}
evalToggleBtnEl.addEventListener('click', () => {
  evalBarVisible = !evalBarVisible;
  localStorage.setItem('evalBarVisible', String(evalBarVisible));
  applyEvalBarVisibility();
});

let oppCoachVisible = localStorage.getItem('oppCoachVisible') !== 'false';
function applyOppCoachVisibility(): void {
  coachOppWrapEl.classList.toggle('hidden', !oppCoachVisible);
  oppToggleBtnEl.classList.toggle('active', oppCoachVisible);
}
oppToggleBtnEl.addEventListener('click', () => {
  oppCoachVisible = !oppCoachVisible;
  localStorage.setItem('oppCoachVisible', String(oppCoachVisible));
  applyOppCoachVisibility();
});

let youCoachVisible = localStorage.getItem('youCoachVisible') !== 'false';
function applyYouCoachVisibility(): void {
  coachYouWrapEl.classList.toggle('hidden', !youCoachVisible);
  youToggleBtnEl.classList.toggle('active', youCoachVisible);
}
youToggleBtnEl.addEventListener('click', () => {
  youCoachVisible = !youCoachVisible;
  localStorage.setItem('youCoachVisible', String(youCoachVisible));
  applyYouCoachVisibility();
});

let cachedVoice: SpeechSynthesisVoice | null = null;

function pickVoice(): SpeechSynthesisVoice | null {
  if (cachedVoice) return cachedVoice;
  const voices = speechSynthesis.getVoices();
  if (!voices.length) return null;
  const enVoices = voices.filter(v => v.lang.startsWith('en'));
  const priority = [
    (v: SpeechSynthesisVoice) => /Ava|Allison|Samantha/.test(v.name) && /enhanced|premium/i.test(v.name),
    (v: SpeechSynthesisVoice) => /enhanced|premium/i.test(v.name),
    (v: SpeechSynthesisVoice) => v.name.startsWith('Google') && v.lang === 'en-US',
    (v: SpeechSynthesisVoice) => v.lang === 'en-US',
    (v: SpeechSynthesisVoice) => v.lang.startsWith('en'),
  ];
  for (const test of priority) {
    const match = enVoices.find(test);
    if (match) { cachedVoice = match; return match; }
  }
  return null;
}

// Pre-load voices as soon as they're available
speechSynthesis.addEventListener('voiceschanged', () => { cachedVoice = null; pickVoice(); });

function speakText(text: string, btn: HTMLButtonElement): void {
  speechSynthesis.cancel();
  if (btn.classList.contains('speaking')) {
    btn.classList.remove('speaking');
    return;
  }
  const utt = new SpeechSynthesisUtterance(text);
  utt.lang = 'en-US';
  utt.rate = 0.95;
  const voice = pickVoice();
  if (voice) utt.voice = voice;
  utt.onend = () => btn.classList.remove('speaking');
  utt.onerror = () => btn.classList.remove('speaking');
  btn.classList.add('speaking');
  speechSynthesis.speak(utt);
}

coachSpeakBtn.addEventListener('click', () => speakText(coachMsgEl.textContent ?? '', coachSpeakBtn));
coachOppSpeakBtn.addEventListener('click', () => speakText(coachOppMsgEl.textContent ?? '', coachOppSpeakBtn));

function generateCoachMessage(
  quality: string,
  evalDropCp: number | null,
  bestSan: string | null,
  mateIn: number | null,
): string {
  if (mateIn !== null) {
    if (mateIn > 0) return `Checkmate in ${mateIn} move${mateIn === 1 ? '' : 's'}!`;
    if (mateIn < 0) return `Opponent has mate in ${Math.abs(mateIn)}.`;
  }
  const pawns = evalDropCp !== null ? (Math.abs(evalDropCp) / 100).toFixed(1) : null;
  const best = bestSan ? ` ${bestSan} was stronger.` : '';
  const bestWas = bestSan ? ` Best was ${bestSan}.` : '';
  switch (quality) {
    case 'excellent': return pawns && evalDropCp! < -50
      ? `Excellent! You gained ${pawns} pawns with that move.`
      : 'Excellent move!';
    case 'good':       return 'Good move. You are on the right track.';
    case 'inaccuracy': return `Slight inaccuracy${pawns ? ` (−${pawns} pawns)` : ''}.${best}`;
    case 'mistake':    return `Mistake — you lost ${pawns ?? '?'} pawns.${bestWas}`;
    case 'blunder':    return `Blunder! You dropped ${pawns ?? '?'} pawns.${bestWas}`;
    default:           return '';
  }
}

function renderAlternatives(
  el: HTMLElement,
  alts: Array<{ moveSan: string; scoreCp: number; mateIn: number | null }>,
  refScoreCp: number,
): void {
  if (!alts.length) { el.classList.add('hidden'); return; }
  el.innerHTML = alts.map(a => {
    const diff = a.scoreCp - refScoreCp;
    const sign = diff >= 0 ? '+' : '−';
    const val = (Math.abs(diff) / 100).toFixed(1);
    const evalStr = a.mateIn !== null ? `M${Math.abs(a.mateIn)}` : `${sign}${val}`;
    const neg = diff < 0;
    return `<span class="coach-alt-chip">${a.moveSan} <span class="alt-eval${neg ? ' neg' : ''}">${evalStr}</span></span>`;
  }).join('');
  el.classList.remove('hidden');
}

// ── PV mode state ────────────────────────────────────────────
let pvMode = false;
let pvModePositions: Array<{ fen: string; from: string; to: string; san: string }> = [];
let pvModeStartMoveNum = 1;
let pvModeStartWhite = true;
let pvModeIndex = -1;
let pvModeRestoreFen = '';
let pvModeRestoreLastMove: { from: string; to: string } | null = null;
let pvModeBtn: HTMLButtonElement | null = null;
let pvModeAutoTimer: ReturnType<typeof setTimeout> | null = null;
let pvTempRows: HTMLElement[] = [];
let pvModeTextSpans: HTMLElement[] = [];
let pvModeTextEl: HTMLElement | null = null;

function clearPvTempRows(): void {
  pvTempRows.forEach(r => r.remove());
  pvTempRows = [];
}

function highlightLastPvMove(): void {
  // Highlight current move in move list
  pvTempRows.forEach(r => r.querySelectorAll('.move-san').forEach(c => c.classList.remove('pv-active')));
  const lastRow = pvTempRows[pvTempRows.length - 1];
  if (lastRow) {
    const cells = lastRow.querySelectorAll('.move-san');
    const active = Array.from(cells).filter(c => c.textContent).pop();
    active?.classList.add('pv-active');
  }
  // Highlight current move in PV text line
  pvModeTextSpans.forEach(s => s.classList.remove('pv-active'));
  if (pvModeIndex >= 0 && pvModeIndex < pvModeTextSpans.length) {
    pvModeTextSpans[pvModeIndex].classList.add('pv-active');
  }
}

function renderPvText(
  el: HTMLElement,
  positions: Array<{ san: string }>,
  startMoveNum: number,
  startWhite: boolean,
): HTMLElement[] {
  el.textContent = '';
  const spans: HTMLElement[] = [];
  let moveNum = startMoveNum;
  let isWhite = startWhite;
  for (const pos of positions) {
    const span = document.createElement('span');
    span.className = 'pv-move-span';
    span.textContent = isWhite ? `${moveNum}.\u00a0${pos.san} ` : `${pos.san} `;
    if (!isWhite) {
      // prefix black move with move number if it's the very first token
      if (spans.length === 0) span.textContent = `${moveNum}…\u00a0${pos.san} `;
      moveNum++;
    }
    isWhite = !isWhite;
    el.appendChild(span);
    spans.push(span);
  }
  return spans;
}

function addPvMoveToList(san: string, moveNum: number, isWhite: boolean): void {
  if (isWhite || pvTempRows.length === 0) {
    const row = document.createElement('div');
    row.className = 'move-row pv-temp';
    const num = document.createElement('span');
    num.className = 'move-num';
    num.textContent = isWhite ? `${moveNum}.` : `${moveNum}…`;
    const cell = document.createElement('span');
    cell.className = 'move-san';
    cell.textContent = san;
    row.append(num, cell);
    if (!isWhite) {
      // black starts — add empty white placeholder so black lands in right column
      const empty = document.createElement('span');
      empty.className = 'move-san';
      row.insertBefore(empty, cell);
    }
    moveListEl.appendChild(row);
    pvTempRows.push(row);
  } else {
    // Add black move to the last row that only has white's move
    const lastRow = pvTempRows[pvTempRows.length - 1];
    const existing = lastRow.querySelectorAll('.move-san');
    if (existing.length === 1) {
      const cell = document.createElement('span');
      cell.className = 'move-san';
      cell.textContent = san;
      lastRow.appendChild(cell);
    }
  }
  moveListEl.scrollTop = moveListEl.scrollHeight;
}

function renderPvHistory(upToIndex: number): void {
  clearPvTempRows();
  let moveNum = pvModeStartMoveNum;
  let isWhite = pvModeStartWhite;
  for (let i = 0; i <= upToIndex && i < pvModePositions.length; i++) {
    addPvMoveToList(pvModePositions[i].san, moveNum, isWhite);
    if (!isWhite) moveNum++;
    isWhite = !isWhite;
  }
}

function navigatePv(index: number): void {
  if (!pvMode || pvModePositions.length === 0) return;
  if (pvModeAutoTimer !== null) { clearTimeout(pvModeAutoTimer); pvModeAutoTimer = null; }
  const clamped = Math.max(0, Math.min(pvModePositions.length - 1, index));
  pvModeIndex = clamped;
  const pos = pvModePositions[clamped];
  board!.setFen(pos.fen, false, isFlipped(), { from: pos.from, to: pos.to });
  refreshEvalBar(pos.fen).catch(() => {});
  renderPvHistory(clamped);
  highlightLastPvMove();
  updateNavButtons();
}

function exitPvMode(): void {
  if (!pvMode) return;
  if (pvModeAutoTimer !== null) { clearTimeout(pvModeAutoTimer); pvModeAutoTimer = null; }
  pvMode = false;
  board!.setFen(pvModeRestoreFen, viewIndex === moveHistory.length - 1 && gameIsActive, isFlipped(), pvModeRestoreLastMove);
  refreshEvalBar(pvModeRestoreFen).catch(() => {});
  clearPvTempRows();
  if (pvModeBtn) {
    pvModeBtn.classList.remove('playing');
    pvModeBtn.textContent = '▶';
    const capturedPositions = pvModePositions;
    const capturedStartMoveNum = pvModeStartMoveNum;
    const capturedStartWhite = pvModeStartWhite;
    const capturedBtn = pvModeBtn;
    pvModeBtn.onclick = () => enterPvMode(capturedPositions, capturedStartMoveNum, capturedStartWhite, capturedBtn);
  }
  // Reset text span highlights
  pvModeTextSpans.forEach(s => s.classList.remove('pv-active'));
  pvModeTextSpans = [];
  pvModeTextEl = null;
  updateNavButtons();
}

function enterPvMode(
  positions: Array<{ fen: string; from: string; to: string; san: string }>,
  startMoveNum: number,
  startWhite: boolean,
  btn: HTMLButtonElement,
  textEl?: HTMLElement,
): void {
  if (pvMode && pvModeBtn === btn) { exitPvMode(); return; }
  if (pvMode) exitPvMode();
  if (!board || positions.length === 0) return;

  pvMode = true;
  pvModePositions = positions;
  pvModeStartMoveNum = startMoveNum;
  pvModeStartWhite = startWhite;
  pvModeIndex = -1;
  pvModeRestoreFen = moveHistory[viewIndex];
  pvModeRestoreLastMove = viewIndex > 0
    ? { from: moveRecords[viewIndex - 1].from, to: moveRecords[viewIndex - 1].to }
    : null;
  pvModeBtn = btn;
  pvModeTextEl = textEl ?? null;
  pvModeTextSpans = textEl ? Array.from(textEl.querySelectorAll('.pv-move-span')) as HTMLElement[] : [];
  btn.classList.add('playing');
  btn.textContent = '■';
  btn.onclick = () => exitPvMode();

  let i = 0;
  let moveNum = startMoveNum;
  let isWhite = startWhite;

  const step = () => {
    if (!pvMode || pvModeBtn !== btn) return;
    if (i >= positions.length) { pvModeAutoTimer = null; return; }
    pvModeIndex = i;
    const pos = positions[i++];
    board!.setFen(pos.fen, false, isFlipped(), { from: pos.from, to: pos.to });
    refreshEvalBar(pos.fen).catch(() => {});
    addPvMoveToList(pos.san, moveNum, isWhite);
    highlightLastPvMove();
    if (!isWhite) moveNum++;
    isWhite = !isWhite;
    updateNavButtons();
    pvModeAutoTimer = setTimeout(step, 800);
  };
  step();
}

function bindPvPlayBtn(
  btn: HTMLButtonElement,
  getPositions: () => Array<{ fen: string; from: string; to: string; san: string }>,
  getStartMoveNum: () => number,
  getStartWhite: () => boolean,
  textEl?: HTMLElement,
): void {
  btn.onclick = () => enterPvMode(getPositions(), getStartMoveNum(), getStartWhite(), btn, textEl);
}

const QUALITY_LABELS: Record<string, string> = {
  excellent:  '⭐ Excellent',
  good:       '✓ Good move',
  inaccuracy: '⚠ Inaccuracy',
  mistake:    '✗ Mistake',
  blunder:    '💥 Blunder',
};

function showCoachPanel(): void {
  applyEvalBarVisibility();
  applyOppCoachVisibility();
  applyYouCoachVisibility();
  coachPanelEl.classList.remove('hidden');
  coachScoreEl.textContent = '—';
  coachQualityEl.textContent = '—';
  coachQualityEl.className = '';
  coachPlayerSanEl.textContent = '—';
  coachBestSanEl.textContent = '—';
  bestPlayBtnEl.classList.add('hidden');
  coachEvalFill.style.left = '50%';
  coachEvalFill.style.width = '0%';
  coachOppPanelEl.classList.remove('hidden');
  coachOppQualityEl.textContent = '';
  coachOppQualityEl.className = '';
  coachOppSanEl.textContent = '—';
  coachOppBestSanEl.textContent = '—';
  coachAskRowEl.classList.add('hidden');
  coachMsgRowEl.classList.add('hidden');
  coachOppAskRowEl.classList.add('hidden');
  coachOppMsgRowEl.classList.add('hidden');
  undoBtnEl.disabled = true;
}

function hideCoachPanel(): void {
  coachEvalWrapEl.classList.add('hidden');
  coachPanelEl.classList.add('hidden');
  coachOppPanelEl.classList.add('hidden');
  undoBtnEl.classList.add('hidden');
}

function applyEvalToBar(scoreCp: number): void {
  const clamped = Math.max(-600, Math.min(600, scoreCp));
  const halfPct = Math.round((Math.abs(clamped) / 1200) * 100); // 0–50%
  if (clamped >= 0) {
    coachEvalFill.style.left = '50%';
    coachEvalFill.style.width = `${halfPct}%`;
    coachEvalFill.style.background = 'linear-gradient(90deg, #a07820, #d4a830)';
    coachEvalFill.style.borderRadius = '0 4px 4px 0';
  } else {
    coachEvalFill.style.left = `${50 - halfPct}%`;
    coachEvalFill.style.width = `${halfPct}%`;
    coachEvalFill.style.background = 'linear-gradient(90deg, #a07820, #d4a830)';
    coachEvalFill.style.borderRadius = '4px 0 0 4px';
  }
  const abs = Math.abs(scoreCp);
  if (abs >= 9900) {
    coachScoreEl.textContent = scoreCp > 0 ? 'Mate (White)' : 'Mate (Black)';
  } else {
    const sign = scoreCp > 0 ? '+' : scoreCp < 0 ? '−' : '';
    coachScoreEl.textContent = `${sign}${(abs / 100).toFixed(1)}`;
  }
}

async function refreshEvalBar(fen: string): Promise<void> {
  try {
    const result = await api.analyzePosition(fen);
    applyEvalToBar(result.scoreCp);
  } catch { /* keep previous value */ }
}

async function runCoachAnalysis(fen: string, previousFen?: string, playerMoveSan?: string): Promise<void> {
  coachSpinnerEl.classList.remove('hidden');
  if (previousFen !== undefined) { coachQualityEl.textContent = '—'; coachQualityEl.className = ''; }
  if (playerMoveSan !== undefined) coachPlayerSanEl.textContent = playerMoveSan;
  coachBestSanEl.textContent = '—';
  try {
    const result = await api.analyzePosition(fen, previousFen, playerMoveSan);
    applyEvalToBar(result.scoreCp);

    // Move quality
    if (result.moveQuality) {
      coachQualityEl.textContent = QUALITY_LABELS[result.moveQuality] ?? '';
      coachQualityEl.className = `quality-${result.moveQuality}`;
    }

    // Best move
    coachBestSanEl.textContent = result.bestMoveSan ?? result.bestMove;
    if (result.bestMovePosition && previousFen !== undefined) {
      const bmp = result.bestMovePosition;
      const prevParts = previousFen.split(' ');
      const prevMoveNum = parseInt(prevParts[5]) || 1;
      const prevIsWhite = prevParts[1] === 'w';
      bestPlayBtnEl.classList.remove('hidden');
      bestPlayBtnEl.onclick = async () => {
        if (!currentGameId) return;
        bestPlayBtnEl.disabled = true;
        try {
          await api.undoMove(currentGameId);
          await handleMove(bmp.from, bmp.to);
        } catch (err: any) {
          statusEl.textContent = err.message;
        } finally {
          bestPlayBtnEl.disabled = false;
        }
      };
    } else {
      bestPlayBtnEl.classList.add('hidden');
    }

    // Show "Ask coach" button — message loads on demand
    coachMsgEl.textContent = '';
    coachMsgRowEl.classList.add('hidden');
    coachSpeakBtn.classList.remove('speaking');
    coachAskRowEl.classList.remove('hidden');
    coachAskBtn.disabled = false;
    coachAskBtn.textContent = 'Ask coach';
    coachAskBtn.onclick = async () => {
      coachAskBtn.disabled = true;
      coachAskBtn.textContent = '…';
      try {
        const msg = await api.requestCoachMessage({
          playerMoveSan: result.moveQuality ? (playerMoveSan ?? null) : null,
          moveQuality: result.moveQuality,
          evalDropCp: result.evalDropCp,
          scoreCp: result.scoreCp ?? 0,
          bestMoveSan: result.bestMoveSan,
          mateIn: result.mateIn,
          alternatives: result.alternatives,
          pv: result.pv,
          isOpponent: false,
          openingName: currentOpeningMatch?.opening.name ?? null,
          openingEco: currentOpeningMatch?.line.eco ?? null,
        });
        coachMsgEl.textContent = msg;
        coachMsgRowEl.classList.toggle('hidden', !msg);
        coachAskRowEl.classList.add('hidden');
      } catch {
        coachAskBtn.textContent = 'Ask coach';
        coachAskBtn.disabled = false;
      }
    };

    // Alternatives
    renderAlternatives(coachAltsEl, result.alternatives, result.scoreCp);

    // PV
    if (result.pv) {
      const positions = result.pvPositions ?? [];
      const startMoveNum = result.pvStartMoveNum ?? 1;
      const startWhite = result.pvStartWhite ?? true;
      renderPvText(coachPvTextEl, positions, startMoveNum, startWhite);
      coachPvEl.classList.remove('hidden');
      bindPvPlayBtn(coachPvPlayBtn, () => positions, () => startMoveNum, () => startWhite, coachPvTextEl);
      coachPvPlayBtn.style.display = positions.length ? '' : 'none';
    }
  } catch {
    coachScoreEl.textContent = '—';
  } finally {
    coachSpinnerEl.classList.add('hidden');
  }
}
async function runOpponentAnalysis(fen: string, previousFen: string, oppMoveSan: string): Promise<void> {
  coachOppQualityEl.textContent = '';
  coachOppQualityEl.className = '';
  coachOppSanEl.textContent = oppMoveSan;
  coachOppBestSanEl.textContent = '—';
  try {
    const result = await api.analyzePosition(fen, previousFen, oppMoveSan, true);
    if (result.moveQuality) {
      coachOppQualityEl.textContent = QUALITY_LABELS[result.moveQuality] ?? '';
      coachOppQualityEl.className = `quality-${result.moveQuality}`;
    }
    coachOppBestSanEl.textContent = result.bestMoveSan ?? result.bestMove;

    // Show "Ask coach" button — message loads on demand
    coachOppMsgEl.textContent = '';
    coachOppMsgRowEl.classList.add('hidden');
    coachOppSpeakBtn.classList.remove('speaking');
    coachOppAskRowEl.classList.remove('hidden');
    coachOppAskBtn.disabled = false;
    coachOppAskBtn.textContent = 'Ask coach';
    coachOppAskBtn.onclick = async () => {
      coachOppAskBtn.disabled = true;
      coachOppAskBtn.textContent = '…';
      try {
        const msg = await api.requestCoachMessage({
          playerMoveSan: result.moveQuality ? (oppMoveSan ?? null) : null,
          moveQuality: result.moveQuality,
          evalDropCp: result.evalDropCp,
          scoreCp: result.scoreCp ?? 0,
          bestMoveSan: result.bestMoveSan,
          mateIn: result.mateIn,
          alternatives: result.alternatives,
          pv: result.pv,
          isOpponent: true,
          openingName: currentOpeningMatch?.opening.name ?? null,
          openingEco: currentOpeningMatch?.line.eco ?? null,
        });
        coachOppMsgEl.textContent = msg;
        coachOppMsgRowEl.classList.toggle('hidden', !msg);
        coachOppAskRowEl.classList.add('hidden');
      } catch {
        coachOppAskBtn.textContent = 'Ask coach';
        coachOppAskBtn.disabled = false;
      }
    };

    // Alternatives
    renderAlternatives(coachOppAltsEl, result.alternatives, result.scoreCp);

    // PV
    if (result.pv) {
      const positions = result.pvPositions ?? [];
      const startMoveNum = result.pvStartMoveNum ?? 1;
      const startWhite = result.pvStartWhite ?? true;
      renderPvText(coachOppPvTextEl, positions, startMoveNum, startWhite);
      coachOppPvEl.classList.remove('hidden');
      bindPvPlayBtn(coachOppPvPlayBtn, () => positions, () => startMoveNum, () => startWhite, coachOppPvTextEl);
      coachOppPvPlayBtn.style.display = positions.length ? '' : 'none';
    }
  } catch { /* keep —  */ }
}

// ─────────────────────────────────────────────────────────────

function setMoveHistory(moves: api.MoveRecord[]): void {
  moveHistory = [INITIAL_FEN, ...moves.map(m => m.fenAfter)];
  moveRecords = moves;
  viewIndex = moveHistory.length - 1;
  updateNavButtons();
  updateOpeningLabel(moves);
}

let currentOpeningMatch: ReturnType<typeof detectOpening> = null;

function updateOpeningLabel(moves: api.MoveRecord[]): void {
  currentOpeningMatch = moves.length ? detectOpening(moves.map(m => m.san)) : null;
  if (currentOpeningMatch) {
    openingLabelEl.textContent = `${currentOpeningMatch.line.eco} · ${currentOpeningMatch.opening.name}`;
    openingLabelEl.classList.remove('hidden');
  } else {
    openingLabelEl.classList.add('hidden');
  }
}

function updateNavButtons(): void {
  if (pvMode) {
    navBackBtn.disabled = pvModeIndex <= 0;
    navFwdBtn.disabled = pvModeIndex >= pvModePositions.length - 1;
  } else {
    navBackBtn.disabled = viewIndex <= 0;
    navFwdBtn.disabled = viewIndex >= moveHistory.length - 1;
  }
  // Show "Play from here" only when viewing a past position in an active vs_computer game
  const isPastPosition = viewIndex < moveHistory.length - 1;
  if (gameIsActive && currentMode === 'vs_computer' && isPastPosition) {
    playFromBtn.classList.remove('hidden');
  } else {
    playFromBtn.classList.add('hidden');
  }
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

  // Update coach panels for the move that brought us to this position
  const fen = moveHistory[viewIndex];
  if (viewIndex === 0) {
    coachQualityEl.textContent = '—'; coachQualityEl.className = '';
    coachPlayerSanEl.textContent = '—'; coachBestSanEl.textContent = '—';
    coachOppQualityEl.textContent = ''; coachOppQualityEl.className = '';
    coachOppSanEl.textContent = '—'; coachOppBestSanEl.textContent = '—';
    refreshEvalBar(fen);
  } else {
    const prevFen = moveHistory[viewIndex - 1];
    const move = moveRecords[viewIndex - 1];
    const isPlayerMove = ((viewIndex - 1) % 2 === 0) === (currentPlayerColor === 'w' || currentPlayerColor === null);
    if (isPlayerMove) {
      runCoachAnalysis(fen, prevFen, move.san).catch(() => {});
    } else {
      runOpponentAnalysis(fen, prevFen, move.san).catch(() => {});
      refreshEvalBar(fen);
    }
  }
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
    w.addEventListener('click', () => navigateTo(i + 1));
    const b = document.createElement('span');
    b.className = 'move-san';
    b.textContent = moves[i + 1]?.san ?? '';
    if (moves[i + 1]) b.addEventListener('click', () => navigateTo(i + 2));
    row.append(num, w, b);
    moveListEl.appendChild(row);
  }
  moveListEl.scrollTop = moveListEl.scrollHeight;
}

// \uFE0E forces text rendering on iOS (prevents emoji-style rendering of chess pieces)
const PIECE_SYMBOLS: Record<string, string> = {
  P: '♙\uFE0E', N: '♘\uFE0E', B: '♗\uFE0E', R: '♖\uFE0E', Q: '♕\uFE0E',
  p: '♟\uFE0E', n: '♞\uFE0E', b: '♝\uFE0E', r: '♜\uFE0E', q: '♛\uFE0E',
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

  function renderCaptures(el: HTMLElement, pieces: string[], scoreDiff: number): void {
    el.innerHTML = '';
    for (const s of pieces) {
      const span = document.createElement('span');
      span.className = 'captured-piece';
      span.textContent = s;
      el.appendChild(span);
    }
    if (scoreDiff > 0) {
      const score = document.createElement('span');
      score.className = 'captured-score';
      score.textContent = `+${scoreDiff}`;
      el.appendChild(score);
    }
  }
  renderCaptures(capturedByWhiteEl, capturedByWhite, diff > 0 ? diff : 0);
  renderCaptures(capturedByBlackEl, capturedByBlack, diff < 0 ? -diff : 0);

  const hasAny = capturedByWhite.length > 0 || capturedByBlack.length > 0;
  capturedPiecesEl.classList.toggle('hidden', !hasAny);
}

let overlayOpeningMatch: ReturnType<typeof detectOpening> = null;

function showOverlay(status: string, moves?: api.MoveRecord[]): void {
  const messages: Record<string, string> = {
    checkmate: 'Checkmate!',
    stalemate: "Stalemate — it's a draw",
    draw: 'Draw',
    resigned: 'Game resigned',
  };
  overlayMsg.textContent = messages[status] ?? 'Game over';
  overlayNewGame.textContent = 'Quit';

  overlayOpeningMatch = moves?.length ? detectOpening(moves.map(m => m.san)) : null;
  if (overlayOpeningMatch) {
    const { opening, line, matchedPlies, deviated, completed } = overlayOpeningMatch;
    if (completed) {
      overlayOpeningText.textContent = `Du spelade hela ${line.name} (${opening.name}) enligt teorin!`;
    } else if (deviated) {
      const moveNumber = Math.ceil((matchedPlies + 1) / 2);
      overlayOpeningText.textContent = `Du spelade ${opening.name} — avvek från ${line.name} på drag ${moveNumber}.`;
    } else {
      overlayOpeningText.textContent = `Du spelade ${opening.name} (${line.name}).`;
    }
    overlayOpeningEl.classList.remove('hidden');
  } else {
    overlayOpeningEl.classList.add('hidden');
  }

  overlayEl.classList.remove('hidden');
}

function returnToStart(): void {
  disconnectFromGame();
  clearGameUrl();
  panelEl.classList.add('hidden');
  hideCoachPanel();
  showProfileCard(userNameEl.textContent ?? '');
  muteBtn.classList.remove('hidden');
  playLobbyMusic();
  currentGameId = null;
  currentPlayerColor = null;
  board = null;
  overlayEl.classList.add('hidden');
  openingLabelEl.classList.add('hidden');
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
    if (isNaN(d.getTime())) return '';
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

    const modeIconEl = document.createElement('div');
    modeIconEl.className = 'mode-icon-sm';
    modeIconEl.innerHTML = modeIcon(g); // SVG is hardcoded, safe

    const cardBody = document.createElement('div');
    cardBody.className = 'card-body';

    const cardTop = document.createElement('div');
    cardTop.className = 'card-top';
    const opponentEl = document.createElement('span');
    opponentEl.className = 'card-opponent';
    opponentEl.textContent = opponentLabel(g);
    const dateEl = document.createElement('span');
    dateEl.className = 'card-date';
    dateEl.textContent = formatDate(g.createdAt);
    cardTop.append(opponentEl, dateEl);

    const cardBottom = document.createElement('div');
    cardBottom.className = 'card-bottom';
    cardBottom.innerHTML = makeBadge(g); // uses only hardcoded strings + server enum values
    if (!isFinished(g.status) && !g.waitingForOpponent) {
      const movesEl = document.createElement('span');
      movesEl.className = 'card-moves';
      movesEl.textContent = `${g.moveCount} moves`;
      cardBottom.appendChild(movesEl);
    }

    cardBody.append(cardTop, cardBottom);
    div.append(modeIconEl, cardBody);
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
overlayOpeningBtn.addEventListener('click', () => {
  if (!overlayOpeningMatch) return;
  const { opening, line } = overlayOpeningMatch;
  returnToStart();
  openTraining();
  startTrainingLine(opening, line);
});
resignBtn.addEventListener('click', async () => {
  if (!currentGameId) return;
  await api.resignGame(currentGameId);
  const state = await api.getGame(currentGameId);
  showOverlay('resigned', state.moves);
  refreshGameList();
});

playFromBtn.addEventListener('click', async () => {
  if (!currentGameId) return;
  playFromBtn.disabled = true;
  try {
    const state = await api.truncateMoves(currentGameId, viewIndex);
    setMoveHistory(state.moves);
    board!.setFen(state.fen, true, isFlipped(), lastMoveOf(state.moves));
    updateStatus(state.status, state.turn, state.mode, state.computerLevel);
    renderMoveList(state.moves);
    updateCapturedPieces(state.fen);
    showCoachPanel();
    refreshGameList();
  } catch (err: any) {
    statusEl.textContent = err.message;
  } finally {
    playFromBtn.disabled = false;
  }
});

undoBtnEl.addEventListener('click', async () => {
  if (!currentGameId) return;
  undoBtnEl.disabled = true;
  try {
    const state = await api.undoMove(currentGameId);
    setMoveHistory(state.moves);
    board!.setFen(state.fen, true, isFlipped(), lastMoveOf(state.moves));
    updateStatus(state.status, state.turn, state.mode, state.computerLevel);
    renderMoveList(state.moves);
    updateCapturedPieces(state.fen);
    showCoachPanel();
    refreshGameList();
    undoBtnEl.disabled = state.moves.length === 0;
  } catch (err: any) {
    statusEl.textContent = err.message;
    undoBtnEl.disabled = false;
  }
});

const lobbyBtn = document.getElementById('lobby-btn')!;
lobbyBtn.classList.add('hidden');
lobbyBtn.addEventListener('click', returnToStart);

navBackBtn.classList.add('hidden');
navFwdBtn.classList.add('hidden');
navBackBtn.addEventListener('click', () => pvMode ? navigatePv(pvModeIndex - 1) : navigateTo(viewIndex - 1));
navFwdBtn.addEventListener('click', () => pvMode ? navigatePv(pvModeIndex + 1) : navigateTo(viewIndex + 1));

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
  await loginWithGoogle();
}));
loginEmailBtns.forEach(btn => btn.addEventListener('click', async () => {
  await loginWithEmailPassword();
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
      const deepGameId = params.get('game');
      history.replaceState({}, '', window.location.pathname);
      await showApp(paymentSuccess);
      if (joinCode) {
        try {
          const state = await api.joinGame(joinCode);
          beginGame(state);
        } catch (e: any) {
          statusEl.textContent = e.message ?? 'Failed to join game';
        }
      } else if (deepGameId) {
        try {
          await loadGame(deepGameId);
        } catch {
          // Game not found or no access — stay in lobby
        }
      }
      return;
    }
    // Not authenticated — save join code so we redirect back after login
    const joinCode = new URLSearchParams(window.location.search).get('join');
    if (joinCode) sessionStorage.setItem('pendingJoin', joinCode);
  } catch (e) {
    console.error('Auth init error:', e);
    statusEl.textContent = 'Failed to initialize. Please refresh the page.';
  }
  loginScreenEl.classList.remove('hidden');
  api.pingBackend().catch(() => {}); // warm up backend while user is on landing page
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
  previewAvatarEl.textContent = AVATAR_PIECES[modalPiece] ?? '♕';
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

// ─────────────────────────────────────────────────────────────────────────────
// TRAINING
// ─────────────────────────────────────────────────────────────────────────────

const trainingOverlayEl     = document.getElementById('training-overlay')!;
const trainingLibraryEl     = document.getElementById('training-library')!;
const trainingLibToggleBtn  = document.getElementById('training-lib-toggle-btn') as HTMLButtonElement;
const trainingInfoEl        = document.getElementById('training-info')!;
const trainingInfoHandleEl  = document.getElementById('training-info-handle')!;
const trainingExploreCounterEl     = document.getElementById('training-explore-counter') as HTMLButtonElement;
const trainingExploreCounterTextEl = document.getElementById('training-explore-counter-text')!;
const trainingLibScrollEl   = document.getElementById('training-lib-scroll')!;
const trainingSearchEl      = document.getElementById('training-search') as HTMLInputElement;
const trainingInfoContentEl = document.getElementById('training-info-content')!;
const trainingActionsEl     = document.getElementById('training-actions') as HTMLElement;
const trainingHintBtn       = document.getElementById('training-hint-btn') as HTMLButtonElement;
const trainingHintAlways    = document.getElementById('training-hint-always') as HTMLInputElement;
const trainingAutoOpponent  = document.getElementById('training-auto-opponent') as HTMLInputElement;
const trainingRetryBtn      = document.getElementById('training-retry-btn') as HTMLButtonElement;
const tstatDotEl            = document.getElementById('tstat-dot')!;
const tstatTextEl           = document.getElementById('tstat-text')!;
const tstatProgressEl       = document.getElementById('tstat-progress')!;
const trainingDotsEl        = document.getElementById('training-dots')!;
const trainingBoardEl       = document.getElementById('training-board')!;
const trainingCompleteBanner = document.getElementById('training-complete-banner')!;
const tcbTitleEl            = document.getElementById('tcb-title')!;
const tcbSubEl              = document.getElementById('tcb-sub')!;
const tcbContinueBtn        = document.getElementById('tcb-continue-btn') as HTMLButtonElement;
const tcbRetryBtn           = document.getElementById('tcb-retry-btn') as HTMLButtonElement;
const trainingCloseBtn      = document.getElementById('training-close-btn') as HTMLButtonElement;

let trainingBoard: Board | null = null;
let trainingSession: TrainingSession | OpeningExploreSession | GlobalExploreSession | null = null;
let globalExploreActiveLineIds: Set<string> | null = null;
let globalExplorePlayerSide: 'white' | 'black' = 'white';
let trainingSelectedOpening: Opening | null = null;
let trainingSelectedLine: OpeningLine | null = null;
let trainingOpeningMoves: { from: string; to: string }[] = [];

function openTraining(): void {
  trainingOverlayEl.classList.remove('hidden');
  if (!trainingBoard) {
    trainingBoard = new Board(trainingBoardEl, (_from, _to) => {
      // moves are intercepted via the session callback wired below
    });
  }
  startGlobalExplore();
}

function startGlobalExplore(side?: 'white' | 'black'): void {
  if (side) globalExplorePlayerSide = side;
  trainingSelectedOpening = null;
  trainingSelectedLine = null;
  trainingCompleteBanner.classList.remove('show');
  trainingActionsEl.style.display = '';
  trainingInfoContentEl.innerHTML = `
    <div class="tinfo-opening-name" style="color:#8ab870">Utforska öppningar</div>
    <div class="tinfo-color-picker">
      <button class="tinfo-color-btn${globalExplorePlayerSide === 'white' ? ' active' : ''}" id="tinfo-color-white">♔ Vit</button>
      <button class="tinfo-color-btn${globalExplorePlayerSide === 'black' ? ' active' : ''}" id="tinfo-color-black">♚ Svart</button>
    </div>
    <div class="tinfo-desc">
      ${globalExplorePlayerSide === 'white'
        ? 'Gör ett drag för att börja. Listan filtreras och visar vilka öppningar som fortfarande är möjliga.'
        : 'Motståndaren gör det första draget. Svara och listan filtreras efter varje drag.'}
    </div>
    <div id="tinfo-feedback" class="tinfo-feedback"></div>
  `;
  document.getElementById('tinfo-color-white')?.addEventListener('click', () => startGlobalExplore('white'));
  document.getElementById('tinfo-color-black')?.addEventListener('click', () => startGlobalExplore('black'));

  trainingSession?.destroy();
  trainingSession = new GlobalExploreSession(OPENINGS, globalExplorePlayerSide, {
    onRender(fen, lastFrom, lastTo) {
      const lm = lastFrom && lastTo ? { from: lastFrom, to: lastTo } : null;
      trainingBoard!.setFen(fen, false, globalExplorePlayerSide === 'black', lm);
    },
    onStatus(type, text) {
      tstatDotEl.className = 'tstat-dot ' + type;
      tstatTextEl.textContent = text;
      trainingBoard!.setInteractive(type === 'you' || type === 'err');
      if (type === 'you' && trainingHintAlways.checked) {
        setTimeout(() => trainingSession?.showHint(), 0);
      }
    },
    onFeedback(type, text) {
      const fb = document.getElementById('tinfo-feedback');
      if (!fb) return;
      fb.className = 'tinfo-feedback' + (type ? ' ' + type : '');
      fb.textContent = text;
    },
    onProgress() {},
    onVariantName() {},
    onHint(fromSq, toSq) {
      document.querySelectorAll('.square.training-hint-from, .square.training-hint-to').forEach(el => {
        el.classList.remove('training-hint-from', 'training-hint-to');
      });
      document.querySelector(`#training-board [data-sq="${fromSq}"]`)?.classList.add('training-hint-from');
      document.querySelector(`#training-board [data-sq="${toSq}"]`)?.classList.add('training-hint-to');
    },
    onComplete() {},
    onMatchingLineIds(ids) {
      globalExploreActiveLineIds = new Set(ids);
      renderTrainingLibrary(trainingSearchEl.value);

      // If all remaining lines belong to a single opening, show its info panel
      const idSet = new Set(ids);
      const matchingOpenings = OPENINGS.filter(op => op.lines.some(l => idSet.has(l.id)));
      if (matchingOpenings.length === 1 && matchingOpenings[0] !== trainingSelectedOpening) {
        trainingSelectedOpening = matchingOpenings[0];
        renderTrainingInfoPanelExplore(matchingOpenings[0]);
      }
      updateExploreCounter(matchingOpenings.length);
    },
    onAutoSelected(lineId) {
      // Find opening + line
      let foundOpening: Opening | null = null;
      let foundLine: OpeningLine | null = null;
      for (const op of OPENINGS) {
        const line = op.lines.find(l => l.id === lineId);
        if (line) { foundOpening = op; foundLine = line; break; }
      }
      if (!foundOpening || !foundLine) return;

      // Grab current position from the global session before replacing it
      const globalSession = trainingSession as GlobalExploreSession;
      const currentFen = globalSession.getCurrentFen();
      const currentMoveIndex = globalSession.getCurrentMoveIndex();

      // Switch to TrainingSession without restarting — continue from current position
      globalExploreActiveLineIds = null;
      trainingSelectedOpening = foundOpening;
      trainingSelectedLine = foundLine;
      trainingExploreCounterEl.classList.add('hidden');
      renderTrainingLibrary();
      renderTrainingInfoPanel(foundOpening, foundLine);

      // Flash variant name to signal auto-detection
      const el = document.getElementById('tinfo-variant-name');
      if (el) {
        el.classList.remove('variant-flash');
        void (el as HTMLElement).offsetWidth;
        el.classList.add('variant-flash');
      }

      const newSession = new TrainingSession(foundOpening, foundLine, {
        onRender(fen, lastFrom, lastTo) {
          const lm = lastFrom && lastTo ? { from: lastFrom, to: lastTo } : null;
          trainingBoard!.setFen(fen, false, foundOpening!.side === 'black', lm);
        },
        onStatus(type, text) {
          tstatDotEl.className = 'tstat-dot ' + type;
          tstatTextEl.textContent = text;
          trainingBoard!.setInteractive(type === 'you' || type === 'err');
          if (type === 'you' && trainingHintAlways.checked) {
            setTimeout(() => trainingSession?.showHint(), 0);
          }
        },
        onFeedback(type, text) {
          const fb = document.getElementById('tinfo-feedback');
          if (!fb) return;
          fb.className = 'tinfo-feedback' + (type ? ' ' + type : '');
          fb.textContent = text;
        },
        onProgress(played, total) {
          tstatProgressEl.textContent = played ? `${played} / ${total} drag` : '';
          trainingDotsEl.innerHTML = '';
          for (let i = 0; i < total; i++) {
            const dot = document.createElement('div');
            dot.className = 'tdot' + (i < played ? ' done' : i === played ? ' current' : '');
            trainingDotsEl.appendChild(dot);
          }
          document.querySelectorAll<HTMLElement>('.tinfo-mv').forEach((el, i) => {
            el.className = 'tinfo-mv' + (i < played ? ' done' : i === played ? ' current' : '');
          });
        },
        onVariantName(name) {
          const el = document.getElementById('tinfo-variant-name');
          if (el) el.textContent = name;
        },
        onHint(fromSq, toSq) {
          document.querySelectorAll('.square.training-hint-from, .square.training-hint-to').forEach(el => {
            el.classList.remove('training-hint-from', 'training-hint-to');
          });
          document.querySelector(`#training-board [data-sq="${fromSq}"]`)?.classList.add('training-hint-from');
          document.querySelector(`#training-board [data-sq="${toSq}"]`)?.classList.add('training-hint-to');
        },
        onComplete(moves) {
          trainingOpeningMoves = moves;
          trainingCompleteBanner.classList.add('show');
          tcbTitleEl.textContent = `${foundLine!.name} — klar!`;
          tcbSubEl.textContent = `Du spelade igenom hela varianten! Fortsätt från denna ställning mot AI.`;
        },
      });

      globalSession.destroy();
      trainingSession = newSession;
      (trainingBoard as any).onMove = (from: string, to: string) => {
        trainingSession?.onSquareClick(from, to);
      };
      newSession.startFrom(currentMoveIndex, currentFen);
    },
  });

  (trainingBoard as any).onMove = (from: string, to: string) => {
    trainingSession?.onSquareClick(from, to);
  };

  globalExploreActiveLineIds = null;  // show all initially
  renderTrainingLibrary();
  trainingSession.setAutoOpponent(trainingAutoOpponent.checked);
  trainingSession.start();
}

function updateExploreCounter(openingCount: number): void {
  if (openingCount > 0) {
    trainingExploreCounterTextEl.textContent = openingCount === 1
      ? '🔍 1 möjlig öppning'
      : `🔍 ${openingCount} möjliga öppningar`;
    trainingExploreCounterEl.classList.remove('hidden');
  } else {
    trainingExploreCounterEl.classList.add('hidden');
  }
}

function closeTraining(): void {
  trainingOverlayEl.classList.add('hidden');
  trainingSession?.destroy();
  trainingSession = null;
  globalExploreActiveLineIds = null;
  trainingLibraryEl.classList.remove('mobile-open');
  trainingInfoEl.classList.remove('mobile-expanded');
  trainingExploreCounterEl.classList.add('hidden');
}

function renderTrainingLibrary(filter = ''): void {
  const active = globalExploreActiveLineIds; // null = no filter active (show all)
  trainingLibScrollEl.innerHTML = '';
  const cats: { id: string; label: string }[] = [
    { id: 'e4', label: 'e4 — Öppna spel' },
    { id: 'd4', label: 'd4 — Slutna spel' },
    { id: 'other', label: 'Annat' },
  ];
  for (const cat of cats) {
    const openings = OPENINGS.filter(o =>
      o.category === cat.id &&
      (!filter || o.name.toLowerCase().includes(filter.toLowerCase()) ||
        o.lines.some(l => l.name.toLowerCase().includes(filter.toLowerCase())))
    );
    if (!openings.length) continue;

    // In global explore mode, skip categories where no lines match
    if (active && !openings.some(o => o.lines.some(l => active.has(l.id)))) continue;

    const catEl = document.createElement('div');
    catEl.className = 'tlib-cat';
    catEl.textContent = cat.label;
    trainingLibScrollEl.appendChild(catEl);

    for (const op of openings) {
      // In global explore mode, skip openings with no matching lines
      if (active && !op.lines.some(l => active.has(l.id))) continue;

      if (op.lines.length === 1) {
        // single-line opening — show as flat item
        const isEliminated = active !== null && !active.has(op.lines[0].id);
        const item = document.createElement('div');
        item.className = 'tlib-item' + (trainingSelectedLine?.id === op.lines[0].id ? ' active' : '') + (isEliminated ? ' tlib-eliminated' : '');
        item.innerHTML = `
          <div class="tlib-side ${op.side === 'white' ? 'tlib-side-w' : 'tlib-side-b'}"></div>
          <div class="tlib-item-name">${op.name}</div>
          <div class="tlib-item-eco">${op.eco}</div>
        `;
        item.addEventListener('click', () => startTrainingLine(op, op.lines[0]));
        trainingLibScrollEl.appendChild(item);
      } else {
        // multi-line opening — collapsible group
        const isExpanded = trainingSelectedOpening?.id === op.id || (active !== null);
        const group = document.createElement('div');
        group.className = 'tlib-group';

        const hdr = document.createElement('div');
        hdr.className = 'tlib-group-hdr' + (isExpanded ? ' active' : '');
        hdr.innerHTML = `
          <div class="tlib-side ${op.side === 'white' ? 'tlib-side-w' : 'tlib-side-b'}"></div>
          <div class="tlib-group-name">${op.name}</div>
          <div class="tlib-group-eco">${op.eco}</div>
          <div class="tlib-arrow ${isExpanded ? 'open' : ''}">▶</div>
        `;

        const variantsEl = document.createElement('div');
        variantsEl.className = 'tlib-variants' + (isExpanded ? ' open' : '');

        // "All variants" explore option — hide in global explore mode
        if (!active) {
          const explore = document.createElement('div');
          const isExploreActive = trainingSelectedOpening?.id === op.id && trainingSelectedLine === null;
          explore.className = 'tlib-variant tlib-variant-explore' + (isExploreActive ? ' active' : '');
          explore.innerHTML = `<span style="flex:1;font-size:0.74rem">🎲 Alla varianter</span>`;
          explore.addEventListener('click', () => startOpeningExplore(op));
          variantsEl.appendChild(explore);
        }

        for (const line of op.lines) {
          if (filter && !line.name.toLowerCase().includes(filter.toLowerCase()) && !op.name.toLowerCase().includes(filter.toLowerCase())) continue;
          const isEliminated = active !== null && !active.has(line.id);
          const v = document.createElement('div');
          v.className = 'tlib-variant' + (trainingSelectedLine?.id === line.id ? ' active' : '') + (isEliminated ? ' tlib-eliminated' : '');
          v.innerHTML = `
            <span style="flex:1;font-size:0.74rem">${line.name}</span>
            <span class="tlib-variant-eco">${line.eco}</span>
          `;
          v.addEventListener('click', () => startTrainingLine(op, line));
          variantsEl.appendChild(v);
        }

        hdr.addEventListener('click', () => {
          const arrow = hdr.querySelector('.tlib-arrow')!;
          const open = variantsEl.classList.toggle('open');
          arrow.classList.toggle('open', open);
          hdr.classList.toggle('active', open);
        });

        group.appendChild(hdr);
        group.appendChild(variantsEl);
        trainingLibScrollEl.appendChild(group);
      }
    }
  }
}

function startTrainingLine(opening: Opening, line: OpeningLine): void {
  globalExploreActiveLineIds = null;
  trainingSelectedOpening = opening;
  trainingSelectedLine = line;
  trainingCompleteBanner.classList.remove('show');
  trainingActionsEl.style.display = '';
  trainingExploreCounterEl.classList.add('hidden');
  renderTrainingLibrary();
  renderTrainingInfoPanel(opening, line);

  trainingSession?.destroy();
  trainingSession = new TrainingSession(opening, line, {
    onRender(fen, lastFrom, lastTo) {
      const lm = lastFrom && lastTo ? { from: lastFrom, to: lastTo } : null;
      trainingBoard!.setFen(fen, false, opening.side === 'black', lm);
    },
    onStatus(type, text) {
      tstatDotEl.className = 'tstat-dot ' + type;
      tstatTextEl.textContent = text;
      trainingBoard!.setInteractive(type === 'you' || type === 'err');
      if (type === 'you' && trainingHintAlways.checked) {
        setTimeout(() => trainingSession?.showHint(), 0);
      }
    },
    onFeedback(type, text) {
      const fb = document.getElementById('tinfo-feedback');
      if (!fb) return;
      fb.className = 'tinfo-feedback' + (type ? ' ' + type : '');
      fb.textContent = text;
    },
    onProgress(played, total) {
      tstatProgressEl.textContent = played ? `${played} / ${total} drag` : '';
      // Update move dots
      trainingDotsEl.innerHTML = '';
      for (let i = 0; i < total; i++) {
        const dot = document.createElement('div');
        dot.className = 'tdot' + (i < played ? ' done' : i === played ? ' current' : '');
        trainingDotsEl.appendChild(dot);
      }
      // Update move strip in info panel
      document.querySelectorAll<HTMLElement>('.tinfo-mv').forEach((el, i) => {
        el.className = 'tinfo-mv' + (i < played ? ' done' : i === played ? ' current' : '');
      });
    },
    onVariantName(name) {
      const el = document.getElementById('tinfo-variant-name');
      if (el) el.textContent = name;
    },
    onHint(fromSq, toSq) {
      // Highlight hint squares on the board
      document.querySelectorAll('.square.training-hint-from, .square.training-hint-to').forEach(el => {
        el.classList.remove('training-hint-from', 'training-hint-to');
      });
      document.querySelector(`#training-board [data-sq="${fromSq}"]`)?.classList.add('training-hint-from');
      document.querySelector(`#training-board [data-sq="${toSq}"]`)?.classList.add('training-hint-to');
    },
    onComplete(moves) {
      trainingOpeningMoves = moves;
      trainingCompleteBanner.classList.add('show');
      tcbTitleEl.textContent = `${line.name} — klar!`;
      tcbSubEl.textContent = `Du spelade igenom hela varianten! Fortsätt från denna ställning mot AI.`;
    },
  });

  // Wire up board clicks → session
  (trainingBoard as any).onMove = (from: string, to: string) => {
    trainingSession?.onSquareClick(from, to);
  };

  trainingSession.setAutoOpponent(trainingAutoOpponent.checked);
  trainingSession.start();
}

function startOpeningExplore(opening: Opening): void {
  globalExploreActiveLineIds = null;
  trainingSelectedOpening = opening;
  trainingSelectedLine = null;
  trainingCompleteBanner.classList.remove('show');
  trainingActionsEl.style.display = '';
  renderTrainingLibrary();
  renderTrainingInfoPanelExplore(opening);

  trainingSession?.destroy();
  trainingSession = new OpeningExploreSession(opening, {
    onRender(fen, lastFrom, lastTo) {
      const lm = lastFrom && lastTo ? { from: lastFrom, to: lastTo } : null;
      trainingBoard!.setFen(fen, false, opening.side === 'black', lm);
    },
    onStatus(type, text) {
      tstatDotEl.className = 'tstat-dot ' + type;
      tstatTextEl.textContent = text;
      trainingBoard!.setInteractive(type === 'you' || type === 'err');
      if (type === 'you' && trainingHintAlways.checked) {
        setTimeout(() => trainingSession?.showHint(), 0);
      }
    },
    onFeedback(type, text) {
      const fb = document.getElementById('tinfo-feedback');
      if (!fb) return;
      fb.className = 'tinfo-feedback' + (type ? ' ' + type : '');
      fb.textContent = text;
    },
    onProgress(played, total) {
      tstatProgressEl.textContent = played ? `${played} / ${total} drag` : '';
      trainingDotsEl.innerHTML = '';
      for (let i = 0; i < total; i++) {
        const dot = document.createElement('div');
        dot.className = 'tdot' + (i < played ? ' done' : i === played ? ' current' : '');
        trainingDotsEl.appendChild(dot);
      }
    },
    onVariantName(name) {
      const el = document.getElementById('tinfo-variant-name');
      if (el) el.textContent = name;
    },
    onVariantDetected(name) {
      // Flash the variant name to signal the moment of determination
      const el = document.getElementById('tinfo-variant-name');
      if (el) {
        el.classList.remove('variant-flash');
        void (el as HTMLElement).offsetWidth; // reflow to restart animation
        el.classList.add('variant-flash');
      }
      const fb = document.getElementById('tinfo-feedback');
      if (fb) {
        fb.className = 'tinfo-feedback branch';
        fb.textContent = `★ Varianten avgjord: ${name}`;
      }
    },
    onActiveLineIds(activeIds) {
      document.querySelectorAll<HTMLElement>('.tinfo-explore-variants [data-line-id]').forEach(li => {
        const isActive = activeIds.includes(li.dataset.lineId!);
        li.classList.toggle('variant-eliminated', !isActive);
      });
    },
    onHint(fromSq, toSq) {
      document.querySelectorAll('.square.training-hint-from, .square.training-hint-to').forEach(el => {
        el.classList.remove('training-hint-from', 'training-hint-to');
      });
      document.querySelector(`#training-board [data-sq="${fromSq}"]`)?.classList.add('training-hint-from');
      document.querySelector(`#training-board [data-sq="${toSq}"]`)?.classList.add('training-hint-to');
    },
    onComplete(moves) {
      trainingOpeningMoves = moves;
      trainingCompleteBanner.classList.add('show');
      const variantEl = document.getElementById('tinfo-variant-name');
      const variantName = variantEl?.textContent ?? opening.name;
      tcbTitleEl.textContent = `${variantName} — klar!`;
      tcbSubEl.textContent = `Du spelade igenom hela varianten! Fortsätt från denna ställning mot AI.`;
    },
  });

  (trainingBoard as any).onMove = (from: string, to: string) => {
    trainingSession?.onSquareClick(from, to);
  };

  trainingSession.setAutoOpponent(trainingAutoOpponent.checked);
  trainingSession.start();
}

function renderTrainingInfoPanel(opening: Opening, line: OpeningLine): void {
  trainingInfoContentEl.innerHTML = `
    <div>
      <div class="tinfo-opening-name">${opening.name}</div>
      <div class="tinfo-variant-name" id="tinfo-variant-name">${line.name}</div>
    </div>
    <div class="tinfo-side-badge">
      <div class="tlib-side ${opening.side === 'white' ? 'tlib-side-w' : 'tlib-side-b'}" style="width:7px;height:7px;border-radius:50%"></div>
      Du spelar som ${opening.side === 'white' ? 'Vit' : 'Svart'}
    </div>
    <div>
      <div class="tinfo-section-label">Om öppningen</div>
      <div class="tinfo-desc">${opening.description}</div>
    </div>
    <div>
      <div class="tinfo-section-label">Drag i varianten</div>
      <div class="tinfo-moves">
        ${line.moves.map((m, i) => {
          const num = i % 2 === 0 ? `<span style="color:#5a4030;font-size:0.62rem;margin-right:1px">${Math.floor(i/2)+1}.</span>` : '';
          return `${num}<span class="tinfo-mv" data-mi="${i}">${m}</span>`;
        }).join(' ')}
      </div>
    </div>
    <div>
      <div class="tinfo-section-label">Tips</div>
      <ul class="tinfo-tips">
        ${line.tips.map(t => `<li>${t}</li>`).join('')}
      </ul>
    </div>
    <div id="tinfo-feedback" class="tinfo-feedback"></div>
  `;
}

function renderTrainingInfoPanelExplore(opening: Opening): void {
  trainingInfoContentEl.innerHTML = `
    <div>
      <div class="tinfo-opening-name">${opening.name}</div>
      <div class="tinfo-variant-name" id="tinfo-variant-name">Varianten avgörs…</div>
    </div>
    <div class="tinfo-side-badge">
      <div class="tlib-side ${opening.side === 'white' ? 'tlib-side-w' : 'tlib-side-b'}" style="width:7px;height:7px;border-radius:50%"></div>
      Du spelar som ${opening.side === 'white' ? 'Vit' : 'Svart'}
    </div>
    <div>
      <div class="tinfo-section-label">Om öppningen</div>
      <div class="tinfo-desc">${opening.description}</div>
    </div>
    <div>
      <div class="tinfo-section-label">Möjliga varianter</div>
      <ul class="tinfo-tips tinfo-explore-variants">
        ${opening.lines.map(l => `<li data-line-id="${l.id}">${l.name}</li>`).join('')}
      </ul>
    </div>
    <div id="tinfo-feedback" class="tinfo-feedback"></div>
  `;
}

trainingBtn.addEventListener('click', openTraining);
trainingCloseBtn.addEventListener('click', closeTraining);
trainingSearchEl.addEventListener('input', () => renderTrainingLibrary(trainingSearchEl.value));
trainingLibToggleBtn.addEventListener('click', () => trainingLibraryEl.classList.toggle('mobile-open'));
trainingExploreCounterEl.addEventListener('click', () => trainingLibraryEl.classList.add('mobile-open'));
trainingInfoHandleEl.addEventListener('click', () => trainingInfoEl.classList.toggle('mobile-expanded'));
// Mobile: picking anything in the library closes the slide-in drawer automatically.
trainingLibScrollEl.addEventListener('click', (e) => {
  if ((e.target as HTMLElement).closest('.tlib-item, .tlib-variant, .tlib-variant-explore')) {
    trainingLibraryEl.classList.remove('mobile-open');
  }
});
trainingHintBtn.addEventListener('click', () => trainingSession?.showHint());
trainingAutoOpponent.addEventListener('change', () => {
  trainingSession?.setAutoOpponent(trainingAutoOpponent.checked);
});
trainingRetryBtn.addEventListener('click', () => {
  trainingCompleteBanner.classList.remove('show');
  trainingSession?.reset();
});
tcbRetryBtn.addEventListener('click', () => {
  trainingCompleteBanner.classList.remove('show');
  trainingSession?.reset();
});
tcbContinueBtn.addEventListener('click', async () => {
  if (!trainingOpeningMoves.length) return;
  tcbContinueBtn.textContent = 'Startar…';
  tcbContinueBtn.disabled = true;
  try {
    const me = await api.getMe();
    if (!me.premium) {
      closeTraining();
      await showPaymentModal();
      tcbContinueBtn.textContent = 'Fortsätt mot AI';
      tcbContinueBtn.disabled = false;
      return;
    }
    const level = await showLevelModal();
    if (level === -1 || level === null) {
      tcbContinueBtn.textContent = 'Fortsätt mot AI';
      tcbContinueBtn.disabled = false;
      if (level === null) {
        closeTraining();
        startNewGame();
      }
      return;
    }
    const opening = [...trainingOpeningMoves];
    const side = trainingSelectedOpening?.side ?? 'white';
    closeTraining();
    tcbContinueBtn.textContent = 'Fortsätt mot AI';
    tcbContinueBtn.disabled = false;
    const state = await api.createGame('vs_computer', level, opening, side);
    beginGame(state);
  } catch (err) {
    console.error('Failed to start training game:', err);
    tcbContinueBtn.textContent = 'Fortsätt mot AI';
    tcbContinueBtn.disabled = false;
  }
});

boot();
