import { useEffect, useState } from 'react';
import { getSocketState, socketStore, subscribeSocket } from '@/store/socket-store';

export type SeatSlot = {
  slotIndex: number;
  userId: string;
  userName: string;
  avatarUrl: string | null;
  isHost: boolean;
};

export type HostStatus = {
  isOnline: boolean;
  userName: string;
  avatarUrl: string | null;
};

export type IncomingSeatRequest = {
  slotIndex: number;
  fromUserId: string;
  fromUserName: string;
  fromAvatarUrl: string | null;
  fromSocketId: string;
};

export type SeatRequestResult = {
  slotIndex: number;
  accepted: boolean;
  reason?: string;
};

export function useRoomSocket(roomId: string) {
  const [state, setState] = useState(getSocketState);

  // Join the room via global store (survives screen unmount on minimize)
  useEffect(() => {
    if (!roomId) return;
    socketStore.join(roomId);
    // Always re-request room state on mount — if socket was already connected
    // (e.g. navigated away and back), this makes the server re-broadcast
    // host_status, seats, and online_count without creating a new socket.
    socketStore.requestRoomState(roomId);
    // Do NOT leave on unmount — socket persists for minimize
    // leave() is called explicitly from handleExit / handleClose in MiniRoomPlayer
  }, [roomId]);

  // Subscribe to state changes
  useEffect(() => {
    const unsub = subscribeSocket(() => setState(getSocketState()));
    return () => unsub();
  }, []);

  return {
    messages: state.messages,
    onlineCount: state.onlineCount,
    connected: state.connected,
    seats: state.seats,
    hostStatus: state.hostStatus,
    incomingRequest: state.incomingRequest,
    seatRequestResult: state.seatRequestResult,
    sendMessage: (text: string) => socketStore.sendMessage(roomId, text),
    requestSeat: (slotIndex: number) => socketStore.requestSeat(roomId, slotIndex),
    acceptSeatRequest: (req: IncomingSeatRequest) => socketStore.acceptSeatRequest(roomId, req),
    rejectSeatRequest: (req: IncomingSeatRequest) => socketStore.rejectSeatRequest(roomId, req),
    clearSeatRequestResult: () => socketStore.clearSeatRequestResult(),
  };
}
