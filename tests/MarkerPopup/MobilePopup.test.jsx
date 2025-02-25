import React from 'react';
import { render, fireEvent } from '@testing-library/react';
import { MapContainer, Marker } from 'react-leaflet';
import { MobilePopup } from '../../src/components/MarkerPopup/MobilePopup';

jest.mock('@react-leaflet/core', () => ({
    useLeafletContext: jest.fn().mockReturnValue({
        map: {
            panTo: jest.fn(),
        },
        overlayContainer: {
            _latlng: { lat: 51.1095, lng: 17.0525 },
            on: jest.fn(),
            off: jest.fn(),
        },
    }),
}));

describe('MobilePopup', () => {
    it('should render Dialog with children', () => {
        const { getByText } = render(
            <MapContainer>
                <MobilePopup>
                    <div>Test Content</div>
                </MobilePopup>
            </MapContainer>,
        );

        expect(getByText('Test Content')).toBeInTheDocument();
    });

    it('should close when close button is clicked', () => {
        const { getByLabelText, queryByText } = render(
            <MapContainer>
                <MobilePopup>
                    <div>Test Content</div>
                </MobilePopup>
            </MapContainer>,
        );

        fireEvent.click(getByLabelText('close'));

        expect(queryByText('Test Content')).not.toBeInTheDocument();
    });
});
