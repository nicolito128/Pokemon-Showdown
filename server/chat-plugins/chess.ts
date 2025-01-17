/**
 * Chess
 * 
 * A plugin that allows users to play chess games.
 * 
 * Inspired by the previous work of mia-pi-git.
 * 
 * @author n128
*/
type Color = 'white' | 'black';

type Position = `${'a' | 'b' | 'c' | 'd' | 'e' | 'f' | 'g' | 'h'}${1 | 2 | 3 | 4 | 5 | 6 | 7 | 8}`;
type Coord = { row: number, col: number };

enum PieceType {
    Pawn = 0b001,
    Rook = 0b010,
    Knight = 0b011,
    Bishop = 0b100,
    Queen = 0b101,
    King = 0b110,
}

type Piece = { type: PieceType, color: Color, position: Position, symbol: string }

enum GameStatus {
    Active = 'active',
    Checkmate = 'checkmate',
    Stalemate = 'stalemate',
    Draw = 'draw',
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

class ChessBoard {
    private whitePieces: bigint;
    private blackPieces: bigint;

    constructor() {
        this.whitePieces = 0n;
        this.blackPieces = 0n;

        this.initializeWhitePieces();
        this.initializeBlackPieces();
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

    private setPiece(board: bigint, position: number, type: PieceType): bigint {
        board = board | (1n << BigInt(position));
        board = board | (BigInt(type) << BigInt(position * 3 + 64));
        return board;
    }

    private removePiece(board: bigint, position: number): bigint {
        // Remover el bit de ocupación
        board = board & ~(1n << BigInt(position));
        // Remover los bits del tipo de pieza
        board = board & ~(0b111n << BigInt(position * 3 + 64));
        return board;
    }

    private isOccupiedBy(position: Position, color: Color): boolean {
        let board: bigint;
        if (color === 'white') {
            board = this.whitePieces;
        } else {
            board = this.blackPieces;
        }

        const coord = positionToCoordinates(position);
        const index = coordinatesToIndex(coord);
        return !!((board >> BigInt(index)) & 1n);
    }

    private getPieceSymbol(type: number, color: Color): string {
        const symbols: { [key: number]: string } = {
            [PieceType.Pawn]: 'P',
            [PieceType.Rook]: 'R',
            [PieceType.Knight]: 'N',
            [PieceType.Bishop]: 'B',
            [PieceType.Queen]: 'Q',
            [PieceType.King]: 'K',
        };
        const symbol = symbols[type];
        return color === 'white' ? symbol : symbol.toLowerCase();
    }

    private getPieceAt(position: Position): Piece | null {
        const coord = positionToCoordinates(position);
        const index = coordinatesToIndex(coord);
        const whiteOccupied = this.isOccupiedBy(position, 'white');
        const blackOccupied = this.isOccupiedBy(position, 'black');

        if (whiteOccupied) {
            const type = Number((this.whitePieces >> BigInt(index * 3 + 64)) & 0b111n);
            return { type, position, color: 'white', symbol: this.getPieceSymbol(type, 'white') };
        } else if (blackOccupied) {
            const type = Number((this.blackPieces >> BigInt(index * 3 + 64)) & 0b111n);
            return { type, position, color: 'black', symbol: this.getPieceSymbol(type, 'black') };
        } else {
            return null;
        }
    }

    private isEmpty(position: Position): boolean {
        return this.getPieceAt(position) === null;
    }

    private isEnemy(position: Position, color: Color): boolean {
        const piece = this.getPieceAt(position);
        return piece !== null && piece.color !== color;
    }

    private getPawnMoves(position: Position, color: Color): Position[] {
        const moves: Position[] = [];
        const { row, col } = positionToCoordinates(position);
        const direction = color === 'white' ? 1 : -1;
        const startRow = color === 'white' ? 1 : 6;

        // Move forward
        if (this.isEmpty(coordinatesToPosition({ row: row + direction, col }))) {
            moves.push(coordinatesToPosition({ row: row + direction, col }));
            if (row === startRow && this.isEmpty(coordinatesToPosition({ row: row + 2 * direction, col }))) {
                moves.push(coordinatesToPosition({ row: row + 2 * direction, col }));
            }
        }

        // Captures
        if (this.isEnemy(coordinatesToPosition({row: row + direction, col: col - 1}), color)) {
            moves.push(coordinatesToPosition({row: row + direction, col: col - 1}));
        }
        if (this.isEnemy(coordinatesToPosition({row: row + direction, col: col + 1}), color)) {
            moves.push(coordinatesToPosition({row: row + direction, col: col + 1}));
        }

        return moves;
    }

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

    private getQueenMoves(position: Position, color: Color): Position[] {
        return [...this.getRookMoves(position, color), ...this.getBishopMoves(position, color)];
    }

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

    public movePiece(from: Position, to: Position): boolean {
        const fromCoords = positionToCoordinates(from);
        const toCoords = positionToCoordinates(to);
        
        const fromIndex = fromCoords.row * 8 + fromCoords.col;
        const toIndex = toCoords.row * 8 + toCoords.col;

        // Get the piece type and color of the piece in the from position
        const whiteOccupied = this.isOccupiedBy(from, 'white');
        const blackOccupied = this.isOccupiedBy(from, 'black');
        
        let piece: Piece | null = this.getPieceAt(from);
        if (!piece) return false;

        if (whiteOccupied) {
            this.whitePieces = this.removePiece(this.whitePieces, fromIndex);
            this.whitePieces = this.setPiece(this.whitePieces, toIndex, piece.type);
        } else if (blackOccupied) {
            this.blackPieces = this.removePiece(this.blackPieces, fromIndex);
            this.blackPieces = this.setPiece(this.blackPieces, toIndex, piece.type);
        }

        return true
    }

    public getLegalMoves(position: Position): Position[] {
        const coord = positionToCoordinates(position);
        const pos = coord.row * 8 + coord.col;

        const whiteOccupied = this.isOccupiedBy(position, 'white');
        const blackOccupied = this.isOccupiedBy(position, 'black');
        if (!whiteOccupied && !blackOccupied) {
            return [];
        }

        const pieceType = whiteOccupied
            ? Number((this.whitePieces >> BigInt(pos * 3 + 64)) & 0b111n)
            : Number((this.blackPieces >> BigInt(pos * 3 + 64)) & 0b111n);

        const color: Color = whiteOccupied ? 'white' : 'black';

        switch (pieceType) {
            case PieceType.Pawn:
                return this.getPawnMoves(position, color);
            case PieceType.Rook:
                return this.getRookMoves(position, color);
            case PieceType.Knight:
                return this.getKnightMoves(position, color);
            case PieceType.Bishop:
                return this.getBishopMoves(position, color);
            case PieceType.Queen:
                return this.getQueenMoves(position, color);
            case PieceType.King:
                return this.getKingMoves(position, color);
            default:
                return [];
        }
    }

    public canCastle(color: Color, side: 'king' | 'queen'): boolean {
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

        return true;
    }

    public isEnPassant(from: Position, to: Position): boolean {
        const fromPiece = this.getPieceAt(from);
        const toPiece = this.getPieceAt(to);
        if (fromPiece?.type !== PieceType.Pawn || toPiece !== null) return false;

        const fromCoord = positionToCoordinates(from);
        const toCoord = positionToCoordinates(to);
        return Math.abs(fromCoord.row - toCoord.row) === 2;
    }

    public isCapture(from: Position, to: Position): boolean {
        const fromPiece = this.getPieceAt(from);
        const toPiece = this.getPieceAt(to);
        return toPiece !== null && toPiece.color !== fromPiece?.color;
    }

    public capturePiece(position: Position): boolean {
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

    public isKingInCheck(kingPosition: Position, color: Color): boolean {
        // Check if any opponent piece can move to the king's position
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

    public isColorInCheck(color: Color): boolean {
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

    public getDistribution(): string[] {
        const dist: string[] = [];
        for (let row = 7; row >= 0; row--) {
            for (let col = 0; col < 8; col++) {
                const position = coordinatesToPosition({ row, col });
                const piece = this.getPieceAt(position);
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

class ChessPlayer extends Rooms.RoomGamePlayer {}

class ChessGame extends Rooms.GameRoom {}

export const commands: Chat.ChatCommands = {
	chess: {
        test(target, room, user) {
            const board = new ChessBoard();
            const distribution = board.getDistribution();

            const letters = 'abcdefgh';
            let output = '<table>';

            // Add the letters of the columns
            output += '<tr><td></td>';
            for (let i = 0; i < 8; i++) {
                output += `<td>${letters[i]}</td>`;
            }
            output += '</tr>';

            // Get an string with the chess table distribution
            for (let i = 0; i < 8; i++) {
                output += '<tr>';
                // Add the number of the row
                output += `<td>${i + 1}</td>`;
                for (let j = 0; j < 8; j++) {
                    output += `<td><b>${distribution[i * 8 + j]}</b></td>`;
                }
                output += '</tr>';
            }
            output += '</table>';
        
            this.sendReply('|raw|' + output);
        },

		'': 'help',
		help(target, room, user) {
			this.parse('/help chess');
		},
	},

	chesshelp: [
        `/chess challenge [user], [long|action|quick|blitz] - challenge an user to a chess game on the specified time modality.`,
        `/chess challenge accept [user] - `,
        `/chess board - displays the board of your current game.`,
        `/chess timer - displays the timers of your current game.`,
        `/chess forfeit - `,
        `/chess offertie - `,
        `/chess accepttie -`,
        `/chess piece [piece] - gives information on the specified chess piece.`,
        `/chess move [old position], [new position] - `,
        `/chess watch [game], [on|off] - spectate or unspectate a chess game.`,
        `/chess disqualify [game], [player] - disqualifies a player from a chess game.`,
        `/chess end [game] - ends a specific chess game abruptly. Requires: % @ # ~`,
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