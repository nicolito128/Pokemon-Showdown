/**
 * Chess
 * 
 * A plugin that allows users to play chess games.
 * 
 * Inspired by the previous work of mia-pi-git.
 * 
 * @author n128
*/
import { Utils } from "../../lib";

// Color type for the pieces and sides
type Color = 'white' | 'black';
// Position with scientific notation (a1, b2, ..., h8)
type Position = `${'a' | 'b' | 'c' | 'd' | 'e' | 'f' | 'g' | 'h'}${1 | 2 | 3 | 4 | 5 | 6 | 7 | 8}`;
// Coordinates for the board. Ex. (0, 0) is the top left corner. They could be converted to positions or indexes.
type Coord = { row: number, col: number };

// TypeScript black magic for no-enum-PieceType and GameStatus
type PieceType = 0b0001 | 0b0010 | 0b0011 | 0b0100 | 0b0101 | 0b0110 | 0b0111 | 0b1000 | 0b1001;
const PieceType = Object.freeze({
    Pawn: 0b0001,
    Rook: 0b0010,
    Knight: 0b0011,
    Bishop: 0b0100,
    Queen: 0b0101,
    King: 0b0110,
    // Special states
    PawnEnPassant: 0b0111,
    KingCastle: 0b1000,
    RookCastle: 0b1001,
});

type GameState = 'prepared' | 'active' | 'checkmate' | 'stalemate' | 'draw';
const GameState = Object.freeze({
    Prepared: 'prepared',
    Active: 'active',
    Checkmate: 'checkmate',
    Stalemate: 'stalemate',
    Draw: 'draw',
});

type Piece = {
    color: Color,
    type: PieceType,
    position: Position,
    symbol: string
}

function positionToCoordinates(position: Position): Coord {
    const letters = 'abcdefgh';
    const letter = position[0];
    const number = parseInt(position[1]);

    const col = letters.indexOf(letter);
    const row = number - 1;

    return { row, col };
}

function coordinatesToPosition(coord: Coord): Position {
    const letters = 'abcdefgh';
    const letter = letters[coord.col];
    const number = coord.row + 1;

    return `${letter}${number}` as Position;
}

function coordinatesToIndex(coord: Coord): number {
    return coord.row * 8 + coord.col;
}

/**
 * Chess Board
 * 
 * Represents a chess board with the current distribution of the pieces
 * and the logic to move them.
 * 
 * The state for black and white pieces are stored in two bigints, a bit field
 * where each segment represents a square on the board.
 * 
 * More info: https://en.wikipedia.org/wiki/Bit_field
*/
class ChessBoard {
    // Representes the current distribution of the whites pieces on the board.
    private whitePieces: bigint;
    // Representes the current distribution of the black pieces on the board.
    private blackPieces: bigint;
    // Offset for the piece type in the bit field. Ex. 0b0001 is a pawn with an offset of 4 bits.
    private bitOffset = 4;
    private maxBinary = 0b1111n;
    // list of en passant pawns for black and white side
    private pawnsEnPassantWhite: bigint;
    private pawnsEnPassantBlack: bigint;
    // flag to check if black and white castle already happen
    private whiteCanCastle = true;
    private blackCanCastle = true;

    constructor() {
        this.whitePieces = 0n;
        this.blackPieces = 0n;
        this.pawnsEnPassantWhite = 0n
        this.pawnsEnPassantBlack = 0n;

        this.initializeWhitePieces();
        this.initializeBlackPieces();
    }

    private initializeBlackPieces() {
        for (let i = 48; i < 56; i++) {
            this.blackPieces = this.setPiece(this.blackPieces, i, PieceType.Pawn);
        }
    
        this.blackPieces = this.setPiece(this.blackPieces, 56, PieceType.Rook);
        this.blackPieces = this.setPiece(this.blackPieces, 63, PieceType.Rook);
    
        this.blackPieces = this.setPiece(this.blackPieces, 57, PieceType.Knight);
        this.blackPieces = this.setPiece(this.blackPieces, 62, PieceType.Knight);
    
        this.blackPieces = this.setPiece(this.blackPieces, 58, PieceType.Bishop);
        this.blackPieces = this.setPiece(this.blackPieces, 61, PieceType.Bishop);
    
        this.blackPieces = this.setPiece(this.blackPieces, 59, PieceType.Queen);
        this.blackPieces = this.setPiece(this.blackPieces, 60, PieceType.King);
    }

    private initializeWhitePieces() {
        for (let i = 8; i < 16; i++) {
            this.whitePieces = this.setPiece(this.whitePieces, i, PieceType.Pawn);
        }
        
        this.whitePieces = this.setPiece(this.whitePieces, 0, PieceType.Rook);
        this.whitePieces = this.setPiece(this.whitePieces, 7, PieceType.Rook);
    
        this.whitePieces = this.setPiece(this.whitePieces, 1, PieceType.Knight);
        this.whitePieces = this.setPiece(this.whitePieces, 6, PieceType.Knight);
    
        this.whitePieces = this.setPiece(this.whitePieces, 2, PieceType.Bishop);
        this.whitePieces = this.setPiece(this.whitePieces, 5, PieceType.Bishop);
    
        this.whitePieces = this.setPiece(this.whitePieces, 3, PieceType.Queen);
        this.whitePieces = this.setPiece(this.whitePieces, 4, PieceType.King);
    }

    // calculateBitLength calculates the length of the bit field for the board.
    private calculateBitLength(position: number): bigint {
        if (Number.isNaN(position)) return 0n;
        return BigInt(position * this.bitOffset + 64);
    }

    // setPiece sets a piece on the board at the specified index position.
    private setPiece(board: bigint, position: number, type: PieceType): bigint {
        board |= (1n << BigInt(position));
        board |= (BigInt(type) << this.calculateBitLength(position));
        return board;
    }

    // removePiece removes a piece from the board at the specified index position.
    private removePiece(board: bigint, position: number): bigint {
        board &= ~(1n << BigInt(position));
        board &= ~(this.maxBinary << this.calculateBitLength(position));
        return board;
    }

    // isOccupiedBy checks if the position is occupied by a piece of the specified color.
    isOccupiedBy(position: Position, color: Color): boolean {
        let board: bigint;
        if (color === 'white') {
            board = this.whitePieces;
        } else {
            board = this.blackPieces;
        }

        const coord = positionToCoordinates(position);
        const index = coordinatesToIndex(coord);
        if (Number.isNaN(index)) return false;

        return !!((board >> BigInt(index)) & 1n);
    }

    // getPieceSymbol returns the symbol for the specified piece type and color.
    // Symbols for white pieces are uppercase and lowercase for black pieces.
    // Ex. 'P' for white pawn and 'p' for black
    getPieceSymbol(type: number, color: Color): string {
        const symbols: { [key: number]: string } = {
            [PieceType.Pawn]: 'P',
            [PieceType.Rook]: 'R',
            [PieceType.Knight]: 'N',
            [PieceType.Bishop]: 'B',
            [PieceType.Queen]: 'Q',
            [PieceType.King]: 'K',
            [PieceType.PawnEnPassant]: 'P',
            [PieceType.KingCastle]: 'K',
            [PieceType.RookCastle]: 'R',
        };
        const symbol = symbols[type];
        return color === 'white' ? symbol : symbol.toLowerCase();
    }

    // getPieceAt returns the piece at the specified position if it exists.
    getPieceAt(position: Position): Piece | null {
        const coord = positionToCoordinates(position);
        const index = coordinatesToIndex(coord);
        const whiteOccupied = this.isOccupiedBy(position, 'white');
        const blackOccupied = this.isOccupiedBy(position, 'black');
        const bitPos = this.calculateBitLength(index)

        if (whiteOccupied) {
            const type = Number((this.whitePieces >> bitPos) & this.maxBinary) as PieceType;
            return { type, position, color: 'white', symbol: this.getPieceSymbol(type, 'white') };
        } else if (blackOccupied) {
            const type = Number((this.blackPieces >> bitPos) & this.maxBinary) as PieceType;
            return { type, position, color: 'black', symbol: this.getPieceSymbol(type, 'black') };
        } else {
            return null;
        }
    }

    // isEmpty checks if the position is empty.
    isEmpty(position: Position): boolean {
        return this.getPieceAt(position) === null;
    }

    // isEnemy checks if the position is occupied by an enemy piece (different color).
    isEnemy(position: Position, color: Color): boolean {
        const piece = this.getPieceAt(position);
        return piece !== null && piece.color !== color;
    }

    // getPawnMoves returns the possible moves for a pawn at the specified position.
    // The pawn can move forward, capture diagonally, move two squares on the first move, and perform en passant.
    private getPawnMoves(position: Position, color: Color): Position[] {
        const moves: Position[] = [];
        const { row, col } = positionToCoordinates(position);
        const direction = color === 'white' ? 1 : -1;
        const startRow = color === 'white' ? 1 : 6;

        // Move forward
        if (this.isEmpty(coordinatesToPosition({ row: row + direction, col }))) {
            moves.push(coordinatesToPosition({ row: row + direction, col }));

            const pos2 = coordinatesToPosition({ row: row + 2 * direction, col })
            if (row === startRow && this.isEmpty(pos2)) {
                moves.push(pos2);
            }
        }

        // Captures
        if (this.isEnemy(coordinatesToPosition({row: row + direction, col: col - 1}), color)) {
            moves.push(coordinatesToPosition({row: row + direction, col: col - 1}));
        }
        if (this.isEnemy(coordinatesToPosition({row: row + direction, col: col + 1}), color)) {
            moves.push(coordinatesToPosition({row: row + direction, col: col + 1}));
        }

        const enPassantRow = color === 'white' ? 4 : 3;
        if (row === enPassantRow) {
            const leftPos = coordinatesToPosition({ row, col: col - 1 });
            const rightPos = coordinatesToPosition({ row, col: col + 1 });

            if (this.isEnemy(leftPos, color) && this.getPieceAt(leftPos)?.type === PieceType.PawnEnPassant) {
                moves.push(coordinatesToPosition({ row: row + direction, col: col - 1 }));
            }
            if (this.isEnemy(rightPos, color) && this.getPieceAt(rightPos)?.type === PieceType.PawnEnPassant) {
                moves.push(coordinatesToPosition({ row: row + direction, col: col + 1 }));
            }
        }

        return moves;
    }

    // getRookMoves returns the possible moves for a rook at the specified position.
    // The rook can move horizontally and vertically until it finds a piece or the board limits.
    private getRookMoves(position: Position, color: Color): Position[] {
        const moves: Position[] = [];
        const { row, col } = positionToCoordinates(position);

        // Horizontal and vertical moves
        for (let i = col + 1; i < 8; i++) {
            const pos = coordinatesToPosition({row, col: i});
            if (this.isEmpty(pos)) {
                moves.push(pos);
            } else {
                if (this.isEnemy(pos, color)) moves.push(pos);
                break;
            }
        }
        for (let i = col - 1; i >= 0; i--) {
            const pos = coordinatesToPosition({row: row, col: i});
            if (this.isEmpty(pos)) {
                moves.push(pos);
            } else {
                if (this.isEnemy(pos, color)) moves.push(pos);
                break;
            }
        }
        for (let i = row + 1; i < 8; i++) {
            const pos = coordinatesToPosition({row: i, col});
            if (this.isEmpty(pos)) {
                moves.push(pos);
            } else {
                if (this.isEnemy(pos, color)) moves.push(pos);
                break;
            }
        }
        for (let i = row - 1; i >= 0; i--) {
            const pos = coordinatesToPosition({row: i, col});
            if (this.isEmpty(pos)) {
                moves.push(pos);
            } else {
                if (this.isEnemy(pos, color)) moves.push(pos);
                break;
            }
        }

        return moves;
    }

    // getKnightMoves returns the possible moves for a knight at the specified position.
    // The knight can move in an L shape, two squares in one direction and one square in the other.
    private getKnightMoves(position: Position, color: Color): Position[] {
        const moves: Position[] = [];
        const { row, col } = positionToCoordinates(position);
        const knightMoves = [
            { row: row + 2, col: col + 1 },
            { row: row + 2, col: col - 1 },
            { row: row - 2, col: col + 1 },
            { row: row - 2, col: col - 1 },
            { row: row + 1, col: col + 2 },
            { row: row + 1, col: col - 2 },
            { row: row - 1, col: col + 2 },
            { row: row - 1, col: col - 2 },
        ];

        for (const move of knightMoves) {
            if (move.row >= 0 && move.row < 8 && move.col >= 0 && move.col < 8) {
                const pos = coordinatesToPosition({row: move.row, col: move.col});
                if (this.isEmpty(pos) || this.isEnemy(pos, color)) {
                    moves.push(pos);
                }
            }
        }

        return moves;
    }

    // getBishopMoves returns the possible moves for a bishop at the specified position.
    // The bishop can move diagonally until it finds a piece or the board limits.
    private getBishopMoves(position: Position, color: Color): Position[] {
        const moves: Position[] = [];
        const { row, col } = positionToCoordinates(position);

        // Diagonal moves
        for (let i = 1; row + i < 8 && col + i < 8; i++) {
            const pos = coordinatesToPosition({row: row + i, col: col + i});
            if (this.isEmpty(pos)) {
                moves.push(pos);
            } else {
                if (this.isEnemy(pos, color)) moves.push(pos);
                break;
            }
        }
        for (let i = 1; row + i < 8 && col - i >= 0; i++) {
            const pos = coordinatesToPosition({row: row + i, col: col - i});
            if (this.isEmpty(pos)) {
                moves.push(pos);
            } else {
                if (this.isEnemy(pos, color)) moves.push(pos);
                break;
            }
        }
        for (let i = 1; row - i >= 0 && col + i < 8; i++) {
            const pos = coordinatesToPosition({row: row - i, col: col + i});
            if (this.isEmpty(pos)) {
                moves.push(pos);
            } else {
                if (this.isEnemy(pos, color)) moves.push(pos);
                break;
            }
        }
        for (let i = 1; row - i >= 0 && col - i >= 0; i++) {
            const pos = coordinatesToPosition({row: row - i, col: col - i});
            if (this.isEmpty(pos)) {
                moves.push(pos);
            } else {
                if (this.isEnemy(pos, color)) moves.push(pos);
                break;
            }
        }

        return moves;
    }

    // getQueenMoves returns the possible moves for a queen at the specified position.
    // The queen can move horizontally, vertically and diagonally until it finds a piece or the board limits.
    private getQueenMoves(position: Position, color: Color): Position[] {
        return [...this.getRookMoves(position, color), ...this.getBishopMoves(position, color)];
    }

    // getKingMoves returns the possible moves for a king at the specified position.
    // The king can move one square in any direction.
    // TODO: Add castling
    private getKingMoves(position: Position, color: Color): Position[] {
        const moves: Position[] = [];
        const { row, col } = positionToCoordinates(position);
        const kingMoves = [
            { row: row + 1, col: col },
            { row: row - 1, col: col },
            { row: row, col: col + 1 },
            { row: row, col: col - 1 },
            { row: row + 1, col: col + 1 },
            { row: row + 1, col: col - 1 },
            { row: row - 1, col: col + 1 },
            { row: row - 1, col: col - 1 },
        ];

        for (const move of kingMoves) {
            if (move.row >= 0 && move.row < 8 && move.col >= 0 && move.col < 8) {
                const pos = coordinatesToPosition({row: move.row, col: move.col});
                if ((this.isEmpty(pos) || this.isEnemy(pos, color)) && !this.isKingInCheck(pos, color)) {
                    moves.push(pos);
                }
            }
        }

        return moves;
    }

    // movePiece moves a piece from the from position to the to position.
    // It returns true if the move was successful.
    movePiece(from: Position, to: Position): boolean {
        const fromCoords = positionToCoordinates(from);
        const toCoords = positionToCoordinates(to);
        
        const fromIndex = fromCoords.row * 8 + fromCoords.col;
        const toIndex = toCoords.row * 8 + toCoords.col;

        // Get the piece type and color of the piece in the from position
        const whiteOccupied = this.isOccupiedBy(from, 'white');
        const blackOccupied = this.isOccupiedBy(from, 'black');
        
        let piece: Piece | null = this.getPieceAt(from);
        if (!piece) return false;

        // Check for en passant capture
        if (piece.type === PieceType.Pawn && Math.abs(fromCoords.row - toCoords.row) === 1 && Math.abs(fromCoords.col - toCoords.col) === 1 && this.isEmpty(to)) {
            const enPassantPos = coordinatesToPosition({ row: fromCoords.row, col: toCoords.col });
            if (this.isOccupiedBy(enPassantPos, piece.color === 'white' ? 'black' : 'white')) {
                this.capturePiece(enPassantPos);
            }
        }

        if (whiteOccupied) {
            this.whitePieces = this.removePiece(this.whitePieces, fromIndex);
            this.whitePieces = this.setPiece(this.whitePieces, toIndex, piece.type);
        } else if (blackOccupied) {
            this.blackPieces = this.removePiece(this.blackPieces, fromIndex);
            this.blackPieces = this.setPiece(this.blackPieces, toIndex, piece.type);
        }

        // Clear en passant flags if necessary
        if (piece.type === PieceType.Pawn) {
            if (piece.color === 'white') {
                this.pawnsEnPassantWhite = 0n;
                if (fromCoords.row === 1 && toCoords.row === 3) {
                    this.pawnsEnPassantWhite = this.setPiece(this.pawnsEnPassantWhite, toIndex, PieceType.PawnEnPassant);
                }
            } else {
                this.pawnsEnPassantBlack = 0n;
                if (fromCoords.row === 6 && toCoords.row === 4) {
                    this.pawnsEnPassantBlack = this.setPiece(this.pawnsEnPassantBlack, toIndex, PieceType.PawnEnPassant);
                }
            }
        }

        return true;
    }

    // getLegalMoves returns the possible moves for the piece at the specified position.
    getLegalMoves(position: Position): Position[] {
        const coord = positionToCoordinates(position);
        const pos = coord.row * 8 + coord.col;

        const whiteOccupied = this.isOccupiedBy(position, 'white');
        const blackOccupied = this.isOccupiedBy(position, 'black');
        if (!whiteOccupied && !blackOccupied) {
            return [];
        }

        const bitOffset = this.calculateBitLength(pos)
        const pieceType = whiteOccupied
            ? Number((this.whitePieces >> bitOffset) & this.maxBinary)
            : Number((this.blackPieces >> bitOffset) & this.maxBinary);

        const color: Color = whiteOccupied ? 'white' : 'black';

        const piece = this.getPieceAt(position);
        if (piece === null) return [];

        switch (piece.type) {
            case PieceType.Pawn:
            case PieceType.PawnEnPassant:
                return this.getPawnMoves(position, piece.color);
            case PieceType.Rook:
            case PieceType.RookCastle:
                return this.getRookMoves(position, piece.color);
            case PieceType.Knight:
                return this.getKnightMoves(position, piece.color);
            case PieceType.Bishop:
                return this.getBishopMoves(position, piece.color);
            case PieceType.Queen:
                return this.getQueenMoves(position, piece.color);
            case PieceType.King:
            case PieceType.KingCastle:
                return this.getKingMoves(position, piece.color);
            default:
                return [];
        }
    }

    // TODO: confirmar que la nueva casilla no este siendo atacada
    // canCastle checks if the king and the rook can castle.
    canCastle(color: Color, side: 'king' | 'queen'): boolean {
        const row = color === 'white' ? 0 : 7;
        const kingPos = coordinatesToPosition({row, col: 4});
        const rookPos = side === 'king'
            ? coordinatesToPosition({row, col: 7})
            : coordinatesToPosition({row, col: 0});

        const kingPiece = this.getPieceAt(kingPos);
        const rookPiece = this.getPieceAt(rookPos);

        if (!kingPiece || !rookPiece) return false;

        // Check if the king or rook has moved
        if (kingPiece.type !== PieceType.King || rookPiece.type !== PieceType.Rook) return false;

        // Check if there are pieces between the king and the rook
        if (side === 'king') {
            for (let i = 5; i < 7; i++) {
                const pos = coordinatesToPosition({row, col: i});
                if (!this.isEmpty(pos)) return false;
            }
        } else {
            for (let i = 1; i < 4; i++) {
                const pos = coordinatesToPosition({row, col: i});
                if (!this.isEmpty(pos)) return false;
            }
        }

        // Check if the king is in check
        if (this.isKingInCheck(kingPos, color)) return false;

        // Check if the new position is being attacked
        const newKingPos = side === 'king'
            ? coordinatesToPosition({row, col: 6})
            : coordinatesToPosition({row, col: 2});
        if (this.isKingInCheck(newKingPos, color)) return false;

        return true;
    }

    // isEnPassant checks if the move is an en passant capture move.
    isEnPassant(from: Position, to: Position): boolean {
        const fromPiece = this.getPieceAt(from);
        const toPiece = this.getPieceAt(to);
        if (fromPiece?.type !== PieceType.Pawn || toPiece !== null) return false;

        const fromCoord = positionToCoordinates(from);
        const toCoord = positionToCoordinates(to);
        return Math.abs(fromCoord.row - toCoord.row) === 2;
    }

    // isCapture checks if the move is a capture move.
    isCapture(from: Position, to: Position): boolean {
        const fromPiece = this.getPieceAt(from);
        const toPiece = this.getPieceAt(to);
        return toPiece !== null && toPiece.color !== fromPiece?.color;
    }

    // isPromotion checks if the move is a promotion move.
    isPromotion(from: Position, to: Position): boolean {
        const fromPiece = this.getPieceAt(from);
        const toCoord = positionToCoordinates(to);
        return fromPiece?.type === PieceType.Pawn && (toCoord.row === 0 || toCoord.row === 7);
    }

    // capturePiece removes the piece at the specified position.
    capturePiece(position: Position): boolean {
        const coord = positionToCoordinates(position);
        const index = coordinatesToIndex(coord);

        if (this.isOccupiedBy(position, 'white')) {
            this.whitePieces = this.removePiece(this.whitePieces, index);
            return true;
        } else if (this.isOccupiedBy(position, 'black')) {
            this.blackPieces = this.removePiece(this.blackPieces, index);
            return true;
        }

        return false;
    }

    // promotion promotes a pawn to the specified piece type.
    promotion(from: Position, to: Position, type: PieceType): boolean {
        const fromPiece = this.getPieceAt(from);
        if (!fromPiece || fromPiece.type !== PieceType.Pawn) return false;

        const coord = positionToCoordinates(to);
        const index = coordinatesToIndex(coord);

        if (fromPiece.color === 'white') {
            this.whitePieces = this.removePiece(this.whitePieces, index);
            this.whitePieces = this.setPiece(this.whitePieces, index, type);
        } else {
            this.blackPieces = this.removePiece(this.blackPieces, index);
            this.blackPieces = this.setPiece(this.blackPieces, index, type);
        }

        return true;
    }

    // isKingInCheck checks if any opponent piece can move to the king's position.
    isKingInCheck(kingPosition: Position, color: Color): boolean {
        const opponentColor = color === 'white' ? 'black' : 'white';
        for (let row = 0; row < 8; row++) {
            for (let col = 0; col < 8; col++) {
                const pos = coordinatesToPosition({row, col});
                if (this.isOccupiedBy(pos, opponentColor)) {
                    const legalMoves = this.getLegalMoves(pos);
                    if (legalMoves.includes(kingPosition)) {
                        return true;
                    }
                }
            }
        }

        return false;
    }

    isColorInCheck(color: Color): boolean {
        // Find the position of the king
        let kingPosition: Position | null = null;
        for (let row = 0; row < 8; row++) {
            for (let col = 0; col < 8; col++) {
                const pos = coordinatesToPosition({row, col});
                const piece = this.getPieceAt(pos);
                if (piece && piece.type === PieceType.King && piece.color === color) {
                    kingPosition = pos;
                    break;
                }
            }
            if (kingPosition) break;
        }

        if (!kingPosition) return false;
        return this.isKingInCheck(kingPosition, color);
    }

    isCheckmate(kingPosition: Position, color: Color): boolean {
        if (!this.isKingInCheck(kingPosition, color)) return false;

        const legalMoves = this.getLegalMoves(kingPosition);
        return legalMoves.length === 0;
    }

    // getDistribution returns the distribution of the pieces on the board in an array of strings.
    getDistribution(): string[] {
        const dist: string[] = [];
        for (let i = 0; i < 8; i++) {
            for (let j = 0; j < 8; j++) {
                const pos = coordinatesToPosition({row: i, col: j});
                const piece = this.getPieceAt(pos);
                if (piece) {
                    dist.push(piece.symbol);
                } else {
                    dist.push('.');
                }
            }
        }

        return dist;
    }
}

class ChessPlayer extends Rooms.RoomGamePlayer {
    side: Color;
	chess: ChessGame;
	user: User;
	wantsTie = false;
	stale = false;
	piecesTaken: string[] = [];
	elo = 0;

    constructor(user: User, game: ChessGame) {
        super(user, game);
        this.side = 'white';
        this.chess = game;
        this.user = user
    }

    send(message: string) {
		this.user.sendTo(this.game.room, message);
	}

	sendControls(html: string) {
		this.send(`|controlshtml|${html}`);
	}

    oppositeSide() {
        return this.side === 'white' ? 'black' : 'white';
    }

    toString(): ID {
        return this.user.id;
    }
}

class ChessGame extends Rooms.RoomGame {
	gameid = 'chess' as ID;
	title = 'Chess';
    turn: string;
	sides: {[side: string]: ChessPlayer};
	playerTable: {[k: string]: ChessPlayer};
	history: string[];
	board: ChessBoard;
    players: ChessPlayer[];
	state: GameState;
	check: {[side: string]: boolean};

    constructor(room: Room) {
        super(room);
        this.turn = '';
        this.sides = {};
        this.playerTable = {};
        this.players = [];
        this.history = [];
        this.board = new ChessBoard();
        this.state = GameState.Prepared;
        this.check = {};
    }

    onJoin(user: User) {
        this.sendBoardTo(user);
	}

    onConnect(user: User) {
		this.onJoin(user);
	}

    addPlayer(user: User): ChessPlayer | null {
        if (this.players.length === 2) return null;

		const player = this.makePlayer(user);
        if (this.players.length === 1) {
            player.side = this.players[0].oppositeSide();
        }

		this.players.push(player);
		this.playerTable[user.id] = player;
		this.sides[player.side] = player;

		return player;
	}

    makePlayer(user: User) {
		return new ChessPlayer(user, this);
	}

    getPlayer(user: User): ChessPlayer {
		const player = this.playerTable[user.id];
		if (!player) throw new Chat.ErrorMessage(`You are not a player in the current game of Chess.`);
		return player;
	}

    sendBoardTo(user: User) {
		if (this.playerTable[user.id]) {
			user.sendTo(this.room.roomid, `|fieldhtml|${this.getBoard(this.playerTable[user.id].side)}`);
		} else {
			user.sendTo(this.room.roomid, `|fieldhtml|${this.getBoard()}`);
		}
	}

    sendBoard() {
        for (const player of this.players) {
            this.sendBoardTo(player.user);
        }
    }

    sendBoarForPosition(player: ChessPlayer, pos: Position) {
        if (this.playerTable[player.id]) {
            const board = this.getBoard(player.side)
            player.user.sendTo(this.room.roomid, `|fieldhtml|${board}`)
        }
    }

    getBoard(side: Color = 'white'): string {
        const distribution = this.board.getDistribution();
        const letters = 'abcdefgh';
        let buf = '<center><table border=1 style="text-align: center; margin: auto; margin-top: 10px;">';

        // Add the letters of the columns
        buf += '<tr><td></td>';
        for (let i = 0; i < 8; i++) {
            buf += `<td style="min-height: 32px; min-width: 32px;">${letters[i]}</td>`;
        }
        buf += '</tr>';

        if (side === 'white') {
            this.reflectDistribution(distribution)
        }

        for (let i = 0; i < 8; i++) {
            buf += '<tr>';
            // Add the number of the row
            if (side === 'white') {
                buf += `<td style="min-height: 32px; min-width: 32px;">${8 - i}</td>`;
            } else {
                buf += `<td style="min-height: 32px; min-width: 32px;">${i + 1}</td>`;
            }
            
            for (let j = 0; j < 8; j++) {
                const elem = distribution[i * 8 + j];
                buf += `<td style="min-height: 32px; min-width: 32px;">`;
                buf += `<button style="min-height: 32px; min-width: 32px;" name="send" value="/chess legal ${coordinatesToPosition({row: i, col: j})}">`;
                buf += ChessGame.convertLetterToChessSymbol(elem);
                buf += '</button>'
                buf += '</td>';
            }
            buf += '</tr>';
        }
        buf += '</table></center>';
        return buf
    }

    // reflect the distribution to set the side pieces at bottom side
    reflectDistribution(dist: string[]) {
        const reflectedDist = new Array(64).fill('.');
        for (let i = 0; i < 8; i++) {
            for (let j = 0; j < 8; j++) {
                reflectedDist[i * 8 + j] = dist[(7 - i) * 8 + j];
            }
        }
        for (let i = 0; i < 64; i++) {
            dist[i] = reflectedDist[i];
        }
    }

    add(message: string, isHTML = true) {
		return this.room?.add(`${isHTML ? `|html|` : ''}${message}`).update();
	}

	addControls(message: string) {
		this.room.add(`|controlshtml|${message}`).update();
	}

    move(player: ChessPlayer, from: Position, to: Position) {
        const fromCoord = positionToCoordinates(from);
        const toCoord = positionToCoordinates(to);
        const fromPos = coordinatesToPosition(fromCoord);
        const toPos = coordinatesToPosition(toCoord);

        if (!this.board.getLegalMoves(fromPos).includes(toPos)) {
            throw new Chat.ErrorMessage(`Invalid move from ${from} to ${to}.`);
        }

        const fromPiece = this.board.getPieceAt(fromPos);
        const toPiece = this.board.getPieceAt(toPos);

        if (fromPiece === null) {
            throw new Chat.ErrorMessage(`There is no piece at ${from}.`);
        }

        if (fromPiece.color !== player.side) {
            throw new Chat.ErrorMessage(`It's not your turn to move.`);
        }

        if (toPiece !== null && toPiece.color === player.side) {
            throw new Chat.ErrorMessage(`You can't capture your own piece.`);
        }

        if (this.board.movePiece(fromPos, toPos)) {
            this.history.push(`${from} ${to}`);
            this.sendBoard();
            this.turn = this.sides[player.oppositeSide()].side;
        }
    }

    start() {
		const nameString = Object.keys(this.playerTable).map(p => this.playerTable[p].name).join(' vs ');
		this.add(Utils.html`<h2>Chess: ${nameString}</h2>`);
		this.state = GameState.Active;

		const player = this.sides['white'];
        if (player) {
            this.turn = player.id
        }

		this.add(Utils.html`<h2>${this.playerTable[this.turn].name}'s turn:</h2>`);
	}

    static convertLetterToChessSymbol(letter: string): string | undefined {
        const symbols: { [key: string]: string } = {
            'P': '\u2659',
            'R': '\u2656',
            'N': '\u2658',
            'B': '\u2657',
            'Q': '\u2655',
            'K': '\u2654',
            'p': '\u265F',
            'r': '\u265C',
            'n': '\u265E',
            'b': '\u265D',
            'q': '\u265B',
            'k': '\u265A',
            '.': ' '
        };

        return symbols[letter];
    }

    static findExistingRoom(user1: string, user2: string) {
        return Rooms.get(`chess-${user1}-${user2}`) || Rooms.get(`chess-${user2}-${user1}`);
    }

    static start(user: User, targetUser: User): Room {
		const existingRoom = ChessGame.findExistingRoom(user.id, targetUser.id);
		const options = {
			modchat: '+' as AuthLevel, isPrivate: 'hidden' as const,
		};

		const roomid = `chess-${targetUser.id}-${user.id}`;
		if (existingRoom) existingRoom.log.log = [];
		const gameRoom = existingRoom ? existingRoom : Rooms.createGameRoom(
			roomid as RoomID, `[Chess] ${user.name} vs ${targetUser.name}`, options
		);

        const chess = new ChessGame(gameRoom);
		gameRoom.game = chess;
        
		user.joinRoom(gameRoom.roomid);
		targetUser.joinRoom(gameRoom.roomid);

        chess.addPlayer(user);
		chess.addPlayer(targetUser);

        chess.start()
		return gameRoom;
	}
}

export const commands: Chat.ChatCommands = {
	chess: {
        test(target, room, user) {
            const targetUser = Users.get(toID(target));
            if (targetUser) {
                ChessGame.start(user, targetUser);
            }
        },

        move(target, room, user) {
            room = this.requireRoom();
			const game = this.requireGame(ChessGame);
			const player = game.getPlayer(user);
			const [location, to] = Utils.splitFirst(target, ',').map(p => p.trim()) as Position[];
			if (!target || !location || !to) {
				return this.parse(`/chess help`);
			}
			game.move(player, location, to);
			this.sendReply(`You moved your piece at ${location} to ${to}.`);
			game.sendBoard();
        },

        legal(target, room, user) {
            room = this.requireRoom();
			const game = this.requireGame(ChessGame);
			const player = game.getPlayer(user);
            const location = target.trim() as Position;
            if (!location) {
                return this.parse(`/chess help`);
            }

            game.sendBoarForPosition(player, location)
        },

		'': 'help',
		help(target, room, user) {
			this.parse('/help chess');
		},
	},

	chesshelp: [
        `/chess challenge [user], [long|action|quick|blitz] - challenge an user to a chess game on the specified time modality.`,
        `/chess challenge accept [user] - `,
        `/chess forfeit - `,
        `/chess offertie - `,
        `/chess accepttie -`,
        `/chess piece [piece] - gives information on the specified chess piece.`,
        `/chess move [old position], [new position] - `,
        `/chess promote [position], [type]`,
    ]
}

export const roomSettings: Chat.SettingsHandler = room => ({
	label: "Chess",
	permission: 'editroom',
	options: [
		[`disabled`, room.settings.chessDisabled || 'uno disable'],
		[`enabled`, !room.settings.chessDisabled || 'uno enable'],
	],
});