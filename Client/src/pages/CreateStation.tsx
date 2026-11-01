import { FormEvent, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, X } from 'lucide-react';
import { stationService } from '@/services/stationService';
import { Button, Card, Input } from '@/components/UI';

const initialForm = {
  name: '',
  street: '',
  area: '',
  city: '',
  division: '',
  postalCode: '',
  longitude: '',
  latitude: '',
  amenities: '',
};

export default function CreateStation() {
  const navigate = useNavigate();
  const [form, setForm] = useState(initialForm);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const updateField = (field: keyof typeof initialForm, value: string) => {
    setForm((current) => ({ ...current, [field]: value }));
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);

    const longitude = Number(form.longitude);
    const latitude = Number(form.latitude);
    if (!Number.isFinite(longitude) || longitude < -180 || longitude > 180) {
      setError('Longitude must be a number between -180 and 180.');
      return;
    }
    if (!Number.isFinite(latitude) || latitude < -90 || latitude > 90) {
      setError('Latitude must be a number between -90 and 90.');
      return;
    }

    try {
      setIsSubmitting(true);
      const response = await stationService.createStation({
        name: form.name.trim(),
        location: { type: 'Point', coordinates: [longitude, latitude] },
        address: {
          street: form.street.trim(),
          area: form.area.trim(),
          city: form.city.trim(),
          division: form.division.trim(),
          ...(form.postalCode.trim() ? { postalCode: form.postalCode.trim() } : {}),
        },
        amenities: form.amenities
          .split(',')
          .map((amenity) => amenity.trim())
          .filter(Boolean),
      });

      if (!response.success) {
        throw new Error(response.message || 'Failed to create station');
      }

      navigate('/operator/dashboard');
    } catch (submitError: any) {
      setError(submitError.message || 'Failed to create station');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 px-4 py-8">
      <div className="mx-auto max-w-3xl">
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-gray-900">Add New Station</h1>
          <p className="mt-1 text-gray-600">Enter the station details and map coordinates.</p>
        </div>

        <Card>
          {error && (
            <div className="mb-6 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-red-700">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-6">
            <Input
              label="Station name"
              value={form.name}
              onChange={(event) => updateField('name', event.target.value)}
              placeholder="Dhaka Central Charging Hub"
              required
              maxLength={100}
            />

            <div>
              <h2 className="mb-3 text-lg font-semibold text-gray-900">Address</h2>
              <div className="grid gap-4 md:grid-cols-2">
                <Input label="Street" value={form.street} onChange={(event) => updateField('street', event.target.value)} required />
                <Input label="Area" value={form.area} onChange={(event) => updateField('area', event.target.value)} required />
                <Input label="City" value={form.city} onChange={(event) => updateField('city', event.target.value)} required />
                <Input label="Division" value={form.division} onChange={(event) => updateField('division', event.target.value)} required />
                <Input label="Postal code" value={form.postalCode} onChange={(event) => updateField('postalCode', event.target.value)} />
              </div>
            </div>

            <div>
              <h2 className="mb-3 text-lg font-semibold text-gray-900">Map location</h2>
              <p className="mb-3 text-sm text-gray-500">Coordinates must be decimal degrees. Longitude comes first in the map data.</p>
              <div className="grid gap-4 md:grid-cols-2">
                <Input
                  label="Longitude"
                  type="number"
                  step="any"
                  min="-180"
                  max="180"
                  value={form.longitude}
                  onChange={(event) => updateField('longitude', event.target.value)}
                  placeholder="90.4125"
                  required
                />
                <Input
                  label="Latitude"
                  type="number"
                  step="any"
                  min="-90"
                  max="90"
                  value={form.latitude}
                  onChange={(event) => updateField('latitude', event.target.value)}
                  placeholder="23.8103"
                  required
                />
              </div>
            </div>

            <Input
              label="Amenities"
              helperText="Optional, comma-separated (for example: WiFi, Restroom, Cafe)"
              value={form.amenities}
              onChange={(event) => updateField('amenities', event.target.value)}
            />

            <div className="flex flex-wrap justify-end gap-3 border-t pt-6">
              <Button type="button" variant="outline" onClick={() => navigate(-1)}>
                <X className="mr-2 h-4 w-4" />
                Cancel
              </Button>
              <Button type="submit" isLoading={isSubmitting}>
                <Plus className="mr-2 h-4 w-4" />
                Create Station
              </Button>
            </div>
          </form>
        </Card>
      </div>
    </div>
  );
}
