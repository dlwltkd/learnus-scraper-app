import React, { createContext, useContext, useState, useCallback, ReactNode } from 'react';
import Toast, { ToastType } from '../components/Toast';
import CustomAlert, { AlertButton, AlertType } from '../components/CustomAlert';

interface ToastState {
    visible: boolean;
    type: ToastType;
    title: string;
    message?: string;
    duration?: number;
}

interface AlertState {
    visible: boolean;
    type: AlertType;
    title: string;
    message?: string;
    buttons: AlertButton[];
}

interface ToastContextType {
    // Toast methods
    showToast: (type: ToastType, title: string, message?: string, duration?: number) => void;
    showSuccess: (title: string, message?: string) => void;
    showError: (title: string, message?: string) => void;
    showInfo: (title: string, message?: string) => void;
    showWarning: (title: string, message?: string) => void;
    hideToast: () => void;

    // Alert methods
    showAlert: (
        title: string,
        message?: string,
        buttons?: AlertButton[],
        type?: AlertType
    ) => void;
    showConfirm: (
        title: string,
        message: string,
        onConfirm: () => void,
        confirmText?: string,
        cancelText?: string
    ) => void;
    hideAlert: () => void;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

export const useToast = (): ToastContextType => {
    const context = useContext(ToastContext);
    if (!context) {
        throw new Error('useToast must be used within a ToastProvider');
    }
    return context;
};

interface ToastProviderProps {
    children: ReactNode;
}

export const ToastProvider: React.FC<ToastProviderProps> = ({ children }) => {
    const [toast, setToast] = useState<ToastState>({
        visible: false,
        type: 'info',
        title: '',
        message: undefined,
        duration: 3000,
    });

    const [alert, setAlert] = useState<AlertState>({
        visible: false,
        type: 'info',
        title: '',
        message: undefined,
        buttons: [{ text: '확인', style: 'default' }],
    });

    // Toast methods
    const showToast = useCallback((
        type: ToastType,
        title: string,
        message?: string,
        duration: number = 3000
    ) => {
        setToast({
            visible: true,
            type,
            title,
            message,
            duration,
        });
    }, []);

    const showSuccess = useCallback((title: string, message?: string) => {
        showToast('success', title, message);
    }, [showToast]);

    const showError = useCallback((title: string, message?: string) => {
        showToast('error', title, message, 4000); // Errors show a bit longer
    }, [showToast]);

    const showInfo = useCallback((title: string, message?: string) => {
        showToast('info', title, message);
    }, [showToast]);

    const showWarning = useCallback((title: string, message?: string) => {
        showToast('warning', title, message);
    }, [showToast]);

    const hideToast = useCallback(() => {
        setToast(prev => ({ ...prev, visible: false }));
    }, []);

    // Alert methods
    const showAlert = useCallback((
        title: string,
        message?: string,
        buttons: AlertButton[] = [{ text: '확인', style: 'default' }],
        type: AlertType = 'info'
    ) => {
        setAlert({
            visible: true,
            type,
            title,
            message,
            buttons,
        });
    }, []);

    const showConfirm = useCallback((
        title: string,
        message: string,
        onConfirm: () => void,
        confirmText: string = '확인',
        cancelText: string = '취소'
    ) => {
        setAlert({
            visible: true,
            type: 'confirm',
            title,
            message,
            buttons: [
                { text: cancelText, style: 'cancel' },
                { text: confirmText, style: 'default', onPress: onConfirm },
            ],
        });
    }, []);

    const hideAlert = useCallback(() => {
        setAlert(prev => ({ ...prev, visible: false }));
    }, []);

    const value: ToastContextType = {
        showToast,
        showSuccess,
        showError,
        showInfo,
        showWarning,
        hideToast,
        showAlert,
        showConfirm,
        hideAlert,
    };

    return (
        <ToastContext.Provider value={value}>
            {children}
            <Toast
                visible={toast.visible}
                type={toast.type}
                title={toast.title}
                message={toast.message}
                duration={toast.duration}
                onHide={hideToast}
            />
            <CustomAlert
                visible={alert.visible}
                type={alert.type}
                title={alert.title}
                message={alert.message}
                buttons={alert.buttons}
                onDismiss={hideAlert}
            />
        </ToastContext.Provider>
    );
};

export default ToastContext;
