-- Trilho de mesa: deixa de ser barrado com as duas pontas decoradas e o meio vazio,
-- e passa a ser estampa corrida, igual a da toalha de mesa. O que distingue os dois
-- produtos e o corte, mais comprido e estreito no trilho, nao a arte.
--
-- Antes: family 'barrado', params {"bands":1,"bandHeightCm":50,"borderPosition":"both"}
update public.applications
set family = 'corrida',
    params = '{"layout":"tossed","rapportCm":30}'::jsonb,
    director_rules = 'Estampa corrida igual a da toalha de mesa, motivos espalhados por toda a area, sem borda e sem centro vazio. O que muda em relacao a toalha e so o corte, mais comprido e estreito.'
where id = 'trilho-de-mesa';
