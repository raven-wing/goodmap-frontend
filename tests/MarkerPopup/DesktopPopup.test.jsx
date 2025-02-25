import React from 'react';
import { render } from '@testing-library/react';
import { MapContainer, Marker } from 'react-leaflet';
import { DesktopPopup } from '../../src/components/MarkerPopup/DesktopPopup';

describe('DesktopPopup', () => {
    it('should render children correctly', () => {
        const { getByText } = render(
            <MapContainer center={[51.1095, 17.0525]} zoom={10}>
                <Marker position={[51.1095, 17.0525]}>
                    <DesktopPopup>
                        <div>Test Content</div>
                    </DesktopPopup>
                </Marker>
            </MapContainer>,
        );

        expect(getByText('Test Content')).toBeInTheDocument();
    });
});
