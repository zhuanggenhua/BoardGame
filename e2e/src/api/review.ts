import { AUTH_API_URL } from '../config/server';

export interface Review {
    _id: string;
    user: {
        _id: string;
        username: string;
        avatar?: string;
    };
    gameId: string;
    isPositive: boolean;
    content?: string;
    createdAt: string;
    updatedAt: string;
}

export interface ReviewStats {
    gameId: string;
    positive: number;
    negative: number;
    total: number;
    rate: number;
}

export interface ReviewListResponse {
    items: Review[];
    page: number;
    limit: number;
    total: number;
    hasMore: boolean;
}

const getAuthHeaders = () => {
    const token = localStorage.getItem('auth_token');
    return {
        'Content-Type': 'application/json',
        'Authorization': token ? `Bearer ${token}` : '',
    };
};

export const fetchReviews = async (gameId: string, page = 1, limit = 10): Promise<ReviewListResponse> => {
    const response = await fetch(`${AUTH_API_URL}/reviews/${gameId}?page=${page}&limit=${limit}`, {
        headers: getAuthHeaders(),
    });
    if (!response.ok) {
        throw new Error('Failed to fetch reviews');
    }
    return response.json();
};

export const fetchReviewStats = async (gameId: string): Promise<ReviewStats> => {
    const response = await fetch(`${AUTH_API_URL}/reviews/${gameId}/stats`, {
        headers: getAuthHeaders(),
    });
    if (!response.ok) {
        throw new Error('Failed to fetch review stats');
    }
    return response.json();
};

export const fetchMyReview = async (gameId: string): Promise<Review | null> => {
    const response = await fetch(`${AUTH_API_URL}/reviews/${gameId}/mine`, {
        headers: getAuthHeaders(),
    });
    if (response.status === 404) return null;
    if (!response.ok) {
        throw new Error('Failed to fetch my review');
    }
    return response.json();
};

export const createReview = async (gameId: string, isPositive: boolean, content?: string): Promise<Review> => {
    const response = await fetch(`${AUTH_API_URL}/reviews/${gameId}`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({ isPositive, content }),
    });
    if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to create review');
    }
    return response.json();
};

export const deleteReview = async (gameId: string): Promise<void> => {
    const response = await fetch(`${AUTH_API_URL}/reviews/${gameId}`, {
        method: 'DELETE',
        headers: getAuthHeaders(),
    });
    if (!response.ok) {
        throw new Error('Failed to delete review');
    }
};
