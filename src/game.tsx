import { useEffect, useMemo, useState } from "react";
import {
  Card,
  CardRank,
  CardDeck,
  CardSuit,
  GameState,
  Hand,
  GameResult,
  HandStatus,
  Suggestion,
} from "./types";

//UI Elements
const CardBackImage = () => (
  <img
    alt="back of card"
    src={process.env.PUBLIC_URL + `/SVG-cards/png/1x/back.png`}
  />
);

const CardImage = ({ suit, rank }: Card) => {
  const card = rank === CardRank.Ace ? 1 : rank;
  return (
    <img
      alt={`${rank} of ${suit}`}
      key={`${rank}-${suit}`}
      src={
        process.env.PUBLIC_URL +
        `/SVG-cards/png/1x/${suit.slice(0, -1)}_${card}.png`
      }
    />
  );
};

//Setup
const newCardDeck = (): CardDeck =>
  Object.values(CardSuit)
    .map((suit) =>
      Object.values(CardRank).map((rank) => ({
        suit,
        rank,
      }))
    )
    .reduce((a, v) => [...a, ...v]);

const shuffle = (deck: CardDeck): CardDeck => {
  return deck.sort(() => Math.random() - 0.5);
};

const takeCard = (deck: CardDeck): { card: Card; remaining: CardDeck } => {
  const card = deck[deck.length - 1];
  const remaining = deck.slice(0, deck.length - 1);
  return { card, remaining };
};

const setupGame = (): GameState => {
  const cardDeck = shuffle(newCardDeck());
  return {
    playerHand: cardDeck.slice(cardDeck.length - 2, cardDeck.length),
    dealerHand: cardDeck.slice(cardDeck.length - 4, cardDeck.length - 2),
    cardDeck: cardDeck.slice(0, cardDeck.length - 4), // remaining cards after player and dealer have been given theirs
    turn: "player_turn",
  };
};

const assertCardValue = (card: Card, currentHandTotal: number): number => {
  switch (card.rank) {
    case CardRank.Ace:
      return currentHandTotal <= 10 ? 11 : 1;
    case CardRank.Jack:
    case CardRank.Queen:
    case CardRank.King:
      return 10;
    default:
      return parseInt(card.rank);
  }
};

//Scoring
const calculateHandScore = (hand: Hand): number => {
  let numberOfAces = 0;
  let score = hand.reduce((acc, card) => {
    if (card.rank === CardRank.Ace) {
      numberOfAces++;
    }
    let cardValue = assertCardValue(card, acc);
    return acc + cardValue;
  }, 0);
  if (numberOfAces > 1 && score > 21) {
    score -= 10;
  }
  return score;
};

const isBlackjack = (hand: Hand, score: number): boolean => {
  return hand.length === 2 && score === 21;
};

const assertHandStatus = (hand: Hand, score: number): HandStatus => {
  return score === 21 && isBlackjack(hand, score)
    ? "blackjack"
    : score > 21
    ? "bust"
    : "active";
};

const isADraw = ({
  playerScore,
  playerHandStatus,
  dealerScore,
  dealerHandStatus,
}: {
  playerScore: number;
  playerHandStatus: HandStatus;
  dealerScore: number;
  dealerHandStatus: HandStatus;
}): boolean => {
  return (
    (playerHandStatus === "blackjack" && dealerHandStatus === "blackjack") ||
    (playerScore === dealerScore &&
      playerHandStatus !== "blackjack" &&
      dealerHandStatus !== "blackjack")
  );
};

const determineGameResult = ({
  dealerHand,
  dealerScore,
  playerHand,
  playerScore,
}: {
  dealerHand: Hand;
  dealerScore: number;
  playerHand: Hand;
  playerScore: number;
}): GameResult => {
  const playerHandStatus = assertHandStatus(playerHand, playerScore);

  if (playerHandStatus === "bust") {
    return "dealer_win";
  }

  const dealerHandStatus = assertHandStatus(dealerHand, dealerScore);

  if (dealerHandStatus === "bust") {
    return "player_win";
  }

  if (
    isADraw({ playerScore, playerHandStatus, dealerScore, dealerHandStatus })
  ) {
    return "draw";
  }

  if (playerHandStatus === "blackjack" || playerScore > dealerScore) {
    return "player_win";
  }

  if (dealerHandStatus === "blackjack" || dealerScore > playerScore) {
    return "dealer_win";
  }

  return "no_result";
};

const softHitConditions = (
  playerScore: number,
  dealerScore: number
): boolean => {
  return (
    (playerScore >= 13 &&
      playerScore <= 16 &&
      dealerScore >= 4 &&
      dealerScore <= 6) ||
    (playerScore === 17 && dealerScore <= 7) ||
    (playerScore === 18 && dealerScore >= 9) ||
    (playerScore === 18 && dealerScore === 10) ||
    (playerScore === 19 && dealerScore === 6)
  );
};
const hardHitConditions = (
  playerScore: number,
  dealerScore: number
): boolean => {
  return (
    (playerScore >= 5 && playerScore <= 7) ||
    (playerScore === 8 && (dealerScore === 5 || dealerScore === 6)) ||
    (playerScore === 9 && dealerScore >= 2 && dealerScore <= 6) ||
    (playerScore === 10 && dealerScore !== 10 && dealerScore !== 11) ||
    ((playerScore === 13 || playerScore === 14) &&
      dealerScore >= 2 &&
      dealerScore <= 6) ||
    (playerScore === 16 && (dealerScore < 2 || dealerScore > 6))
  );
};

const getPlayerActionSuggestion = (state: GameState): Suggestion => {
  const playerHasAce = state.playerHand.some(
    (card) => card.rank === CardRank.Ace
  );
  const playerScore = calculateHandScore(state.playerHand);
  const dealerScore = assertCardValue(state.dealerHand[0], 0);

  if (
    (playerHasAce && softHitConditions(playerScore, dealerScore)) ||
    hardHitConditions(playerScore, dealerScore)
  ) {
    return Suggestion.Hit;
  }

  return Suggestion.Stand;
};

//Player Actions
const playerStands = (state: GameState): GameState => {
  return {
    ...state,
    turn: "dealer_turn",
  };
};

const playerHits = (state: GameState): GameState => {
  const { card, remaining } = takeCard(state.cardDeck);
  return {
    ...state,
    cardDeck: remaining,
    playerHand: [...state.playerHand, card],
  };
};

const dealerHits = (state: GameState): GameState => {
  const { card, remaining } = takeCard(state.cardDeck);
  return {
    ...state,
    cardDeck: remaining,
    dealerHand: [...state.dealerHand, card],
  };
};

const dealersTurn = (state: GameState): GameState => {
  let newState = state;
  let dealerScore = calculateHandScore(state.dealerHand);
  while (dealerScore < 17) {
    newState = dealerHits(newState);
    dealerScore = calculateHandScore(newState.dealerHand);
  }
  return newState;
};

//UI Component
const Game = (): JSX.Element => {
  const [state, setState] = useState(setupGame());
  const [gameResult, setGameResult] = useState<GameResult>(
    "no_result" as GameResult
  );
  const [suggestion, setSuggestion] = useState<Suggestion>(Suggestion.Empty);
  const [helpDisabled, setHelpDisabled] = useState(false);

  const playerScore = useMemo(
    () => calculateHandScore(state.playerHand),
    [state.playerHand]
  );

  const dealerScore = useMemo(
    () => calculateHandScore(state.dealerHand),
    [state.dealerHand]
  );

  const onClickHelp = () => {
    setHelpDisabled(true);
    setSuggestion(getPlayerActionSuggestion(state));
  };

  const onClickReset = () => {
    setHelpDisabled(false);
    setSuggestion(Suggestion.Empty);
    setState(setupGame());
  };

  useEffect(() => {
    if (state.turn === "dealer_turn") {
      setGameResult(
        determineGameResult({
          dealerHand: state.dealerHand,
          dealerScore,
          playerHand: state.playerHand,
          playerScore,
        })
      );
    }
  }, [
    dealerScore,
    playerScore,
    state.dealerHand,
    state.playerHand,
    state.turn,
  ]);

  useEffect(() => {
    if (state.turn === "dealer_turn" && playerScore <= 21) {
      const newState = dealersTurn(state);
      setState(newState);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.turn]);

  useEffect(() => {
    if (playerScore > 21) {
      setState(playerStands);
    }
  }, [playerScore]);

  return (
    <>
      <div>
        <p>There are {state.cardDeck.length} cards left in deck</p>
        <button
          disabled={state.turn === "dealer_turn"}
          onClick={(): void => setState(playerHits)}>
          Hit
        </button>
        <button
          disabled={state.turn === "dealer_turn"}
          onClick={(): void => setState(playerStands)}>
          Stand
        </button>
        <button onClick={onClickReset}>Reset</button>
        <button onClick={onClickHelp} disabled={helpDisabled}>
          Help
        </button>
      </div>
      {suggestion && <p>{suggestion}</p>}
      <p>Player Cards</p>
      <div>
        {state.playerHand.map(CardImage)}
        <p>Player Score {playerScore}</p>
      </div>
      <p>Dealer Cards</p>
      {state.turn === "player_turn" && state.dealerHand.length > 0 ? (
        <div>
          <CardBackImage />
          <CardImage {...state.dealerHand[1]} />
        </div>
      ) : (
        <div>
          {state.dealerHand.map(CardImage)}
          <p>Dealer Score {dealerScore}</p>
        </div>
      )}
      {state.turn === "dealer_turn" && gameResult !== "no_result" ? (
        <p>{gameResult}</p>
      ) : (
        <p>{state.turn}</p>
      )}
    </>
  );
};

export {
  Game,
  playerHits,
  playerStands,
  dealersTurn,
  determineGameResult,
  calculateHandScore,
  setupGame,
};
