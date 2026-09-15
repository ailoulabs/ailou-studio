-- Guardanapo: passa a usar o formato de acento unico num canto (accent: corner),
-- em vez de moldura/varios quadros. O corte ja repete o mesmo desenho 3x, entao
-- a arte deve ser UM guardanapo (fundo liso + um buque num canto), nunca varios quadros.
update public.applications
set params = jsonb_set(params, '{frames,accent}', '"corner"'::jsonb, true),
    director_rules = 'Um guardanapo so, nunca varios quadros: fundo liso claro e um unico buque pequeno em um canto, todo o resto vazio. O corte de 50 x 150 rende 3 guardanapos iguais.'
where id = 'guardanapo';
