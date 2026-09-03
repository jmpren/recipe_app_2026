-- Metric <-> imperial conversion (Phase 2).
--
-- Pure math, no table access -- but it lives in the DB, not the client, because
-- it's shared business logic: the conversion factors and rounding must be
-- identical across the React web app and the future Swift / React Native
-- clients (PLAN.md Section 3). Stored amounts never change; this is display-only.
--
-- convert_measurement(quantity, unit, target) -> jsonb { quantity, unit, converted }
--   target: 'metric' | 'imperial'. Unknown/unconvertible unit or null quantity
--   returns the input unchanged with converted=false.
-- convert_measurements(items jsonb, target) -> jsonb array
--   maps the scalar over [{quantity, unit}, ...], preserving order, so a whole
--   ingredient list converts in one round trip.

create or replace function public.convert_measurement(
  quantity numeric,
  unit text,
  target text
)
returns jsonb
language plpgsql
immutable
as $$
declare
  u text := lower(btrim(coalesce(unit, '')));
  ml_per numeric;   -- ml per 1 of `unit`, if it's a volume unit
  g_per numeric;    -- g per 1 of `unit`, if it's a weight unit
  base numeric;     -- total in ml or g
  q numeric;
  out_unit text;
  unchanged jsonb := jsonb_build_object('quantity', quantity, 'unit', unit, 'converted', false);
begin
  if target not in ('metric', 'imperial') then
    raise exception 'convert_measurement: target must be metric or imperial' using errcode = '22023';
  end if;

  if quantity is null or u = '' then
    return unchanged;
  end if;

  u := rtrim(u, '.');

  ml_per := case u
    when 'tsp' then 4.92892 when 'teaspoon' then 4.92892 when 'teaspoons' then 4.92892
    when 'tbsp' then 14.7868 when 'tbs' then 14.7868 when 'tbl' then 14.7868
    when 'tablespoon' then 14.7868 when 'tablespoons' then 14.7868
    when 'cup' then 236.588 when 'cups' then 236.588
    when 'fl oz' then 29.5735 when 'floz' then 29.5735
    when 'fluid ounce' then 29.5735 when 'fluid ounces' then 29.5735
    when 'pint' then 473.176 when 'pints' then 473.176 when 'pt' then 473.176
    when 'quart' then 946.353 when 'quarts' then 946.353 when 'qt' then 946.353
    when 'gallon' then 3785.41 when 'gallons' then 3785.41 when 'gal' then 3785.41
    when 'ml' then 1 when 'milliliter' then 1 when 'milliliters' then 1
    when 'millilitre' then 1 when 'millilitres' then 1
    when 'l' then 1000 when 'liter' then 1000 when 'liters' then 1000
    when 'litre' then 1000 when 'litres' then 1000
    else null
  end;

  g_per := case u
    when 'oz' then 28.3495 when 'ounce' then 28.3495 when 'ounces' then 28.3495
    when 'lb' then 453.592 when 'lbs' then 453.592
    when 'pound' then 453.592 when 'pounds' then 453.592
    when 'g' then 1 when 'gram' then 1 when 'grams' then 1
    when 'kg' then 1000 when 'kilogram' then 1000 when 'kilograms' then 1000
    else null
  end;

  if ml_per is not null then
    base := quantity * ml_per;
    if target = 'metric' then
      if base >= 1000 then
        q := round(base / 1000, 2); out_unit := 'l';
      elsif base < 10 then
        q := round(base, 1); out_unit := 'ml';
      else
        q := round(base, 0); out_unit := 'ml';
      end if;
    else  -- imperial
      if base < 15 then
        q := round(base / 4.92892 * 8) / 8; out_unit := 'tsp';
      elsif base < 60 then
        q := round(base / 14.7868 * 8) / 8; out_unit := 'tbsp';
      else
        q := round(base / 236.588 * 8) / 8; out_unit := 'cup';
      end if;
    end if;
    return jsonb_build_object('quantity', q, 'unit', out_unit, 'converted', true);
  end if;

  if g_per is not null then
    base := quantity * g_per;
    if target = 'metric' then
      if base >= 1000 then
        q := round(base / 1000, 2); out_unit := 'kg';
      elsif base < 10 then
        q := round(base, 1); out_unit := 'g';
      else
        q := round(base, 0); out_unit := 'g';
      end if;
    else  -- imperial
      if base >= 453.592 then
        q := round(base / 453.592 * 8) / 8; out_unit := 'lb';
      else
        q := round(base / 28.3495 * 8) / 8; out_unit := 'oz';
      end if;
    end if;
    return jsonb_build_object('quantity', q, 'unit', out_unit, 'converted', true);
  end if;

  return unchanged;
end;
$$;

create or replace function public.convert_measurements(items jsonb, target text)
returns jsonb
language sql
immutable
as $$
  select coalesce(
    jsonb_agg(
      public.convert_measurement((e ->> 'quantity')::numeric, e ->> 'unit', target)
      order by ord
    ),
    '[]'::jsonb
  )
  from jsonb_array_elements(coalesce(items, '[]'::jsonb)) with ordinality as t(e, ord);
$$;
