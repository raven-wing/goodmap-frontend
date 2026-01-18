import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react';
import { ReportProblemForm } from '../../src/components/MarkerPopup/ReportProblemForm';

// Mock fetch globally
const mockFetch = jest.fn();

// Mock CSRF token meta tag
beforeEach(() => {
    const metaTag = document.createElement('meta');
    metaTag.setAttribute('name', 'csrf-token');
    metaTag.setAttribute('content', 'test-csrf-token');
    document.head.appendChild(metaTag);

    globalThis.fetch = mockFetch;
    mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ success: true, message: 'Reported' }),
    });
});

afterEach(() => {
    const metaTag = document.querySelector('meta[name="csrf-token"]');
    if (metaTag) {
        metaTag.remove();
    }
    jest.clearAllMocks();
});

describe('ReportProblemForm', () => {
    it('submits the form with selected problem type', async () => {
        const { getByText, getByLabelText } = render(<ReportProblemForm placeId="test-id" />);
        const select = getByLabelText(/What's the problem\?/i);
        fireEvent.change(select, { target: { value: 'broken' } });

        fireEvent.click(getByText(/Submit/i));

        await waitFor(() => {
            expect(mockFetch).toHaveBeenCalledWith('/api/report-location', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-CSRFToken': 'test-csrf-token',
                },
                body: JSON.stringify({ id: 'test-id', description: 'broken' }),
            });
        });
    });

    it('submits the form with custom problem description', async () => {
        const { getByText, getByLabelText } = render(<ReportProblemForm placeId="test-id" />);
        const select = getByLabelText(/What's the problem\?/i);
        fireEvent.change(select, { target: { value: 'other' } });
        const input = getByLabelText(/Please describe:/i);
        fireEvent.change(input, { target: { value: 'Custom problem' } });
        fireEvent.click(getByText(/Submit/i));

        await waitFor(() => {
            expect(mockFetch).toHaveBeenCalledWith('/api/report-location', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-CSRFToken': 'test-csrf-token',
                },
                body: JSON.stringify({ id: 'test-id', description: 'Custom problem' }),
            });
        });
    });

    it('does not render submit button when no problem type is selected', () => {
        const { queryByText, getByLabelText } = render(<ReportProblemForm placeId="test-id" />);

        const select = getByLabelText(/What's the problem\?/i);
        expect(select.value).toBe('');

        const submitButton = queryByText(/Submit/i);
        expect(submitButton).toBeNull();
    });
});
