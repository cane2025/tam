import { AppState } from '../types';
interface SaveBarProps {
    state: AppState;
    onSaveComplete?: (success: boolean) => void;
}
export default function SaveBar({ state, onSaveComplete }: SaveBarProps): import("react/jsx-runtime").JSX.Element;
export {};
