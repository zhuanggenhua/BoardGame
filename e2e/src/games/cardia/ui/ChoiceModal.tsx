/**
 * 通用选择弹窗组件
 * 
 * 用于显示多个选项供玩家选择（如宫廷卫士的"弃牌/不弃牌"选择）
 */

import { motion } from 'framer-motion';

interface ChoiceOption {
    id: string;
    label: string;
    description?: string;
}

interface Props {
    title: string;
    description?: string;
    options: ChoiceOption[];
    onConfirm: (optionId: string) => void;
    onCancel: () => void;
}

export function ChoiceModal({ title, description, options, onConfirm, onCancel }: Props) {
    return (
        <div className="fixed inset-0 z-[300] flex items-end justify-center bg-black/50 p-3 sm:items-center sm:p-4">
            <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                className="max-h-[85vh] w-full max-w-md overflow-y-auto rounded-t-2xl border-4 border-amber-900 bg-amber-50 p-4 shadow-2xl sm:rounded-lg sm:p-6"
            >
                {/* 标题 */}
                <h2 className="mb-3 text-center text-xl font-bold text-amber-900 sm:mb-4 sm:text-2xl">
                    {title}
                </h2>
                
                {/* 描述 */}
                {description && (
                    <p className="mb-5 text-center text-sm text-amber-800 sm:mb-6 sm:text-base">
                        {description}
                    </p>
                )}
                
                {/* 选项列表 */}
                <div className="mb-5 space-y-3 sm:mb-6">
                    {options.map((option) => (
                        <button
                            key={option.id}
                            onClick={() => onConfirm(option.id)}
                            className="w-full rounded-lg border-2 border-amber-700 bg-amber-100 p-3 text-left transition-colors hover:bg-amber-200 sm:p-4"
                        >
                            <div className="mb-1 font-bold text-amber-900">
                                {option.label}
                            </div>
                            {option.description && (
                                <div className="text-sm text-amber-700">
                                    {option.description}
                                </div>
                            )}
                        </button>
                    ))}
                </div>
                
                {/* 取消按钮 */}
                <button
                    onClick={onCancel}
                    className="w-full rounded-lg border-2 border-gray-600 bg-gray-300 py-3 text-sm font-semibold text-gray-800 transition-colors hover:bg-gray-400 sm:text-base"
                >
                    取消
                </button>
            </motion.div>
        </div>
    );
}
