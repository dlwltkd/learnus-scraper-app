import { useRef, useEffect } from 'react';
import { View } from 'react-native';
import { useTour } from '../context/TourContext';

export function useTourRef(key: string) {
    const ref = useRef<View>(null);
    const { registerRef, unregisterRef, isActive } = useTour();

    useEffect(() => {
        if (isActive) {
            registerRef(key, ref as any);
        }
        return () => unregisterRef(key);
    }, [isActive, key]);

    return ref;
}
