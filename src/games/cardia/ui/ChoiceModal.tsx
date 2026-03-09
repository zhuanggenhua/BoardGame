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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
            <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                className="bg-amber-50 border-4 border-amber-900 rounded-lg shadow-2xl p-6 max-w-md w-full mx-4"
            >
                {/* 标题 */}
                <h2 className="text-2xl font-bold text-amber-900 mb-4 text-center">
                    {title}
                </h2>
                
                {/* 描述 */}
                {description && (
                    <p className="text-amber-800 mb-6 text-center">
                        {description}
                    </p>
                )}
                
                {/* 选项列表 */}
                <div className="space-y-3 mb-6">
                    {options.map((option) => (
                        <button
                            key={option.id}
                            onClick={() => onConfirm(option.id)}
                            className="w-full bg-amber-100 hover:bg-amber-200 border-2 border-amber-700 rounded-lg p-4 text-left transition-colors"
                        >
                            <div className="font-bold text-amber-900 mb-1">
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
                    className="w-full bg-gray-300 hover:bg-gray-400 border-2 border-gray-600 rounded-lg py-2 text-gray-800 font-semibold transition-colors"
                >
                    取消
                </button>
            </motion.div>
        </div>
    );
}
