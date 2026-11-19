# NEXORA — read-only аудит Cloudflare

Дата: 19 ноября 2026 г.
Область: только чтение конфигурации и исходников. Никакие ресурсы Cloudflare не изменялись.

## Pages

В списке Pages-проектов аккаунта найден проект `nexora-home-ai-preview`. Запрос проекта с именем `nexora-home-ai` вернул 404, поэтому этот идентификатор нельзя использовать как Production Pages project без дополнительной проверки домена/проекта.

Настройки `nexora-home-ai-preview`:
- production branch: `main`;
- production deployments: выключены;
- preview deployment setting: `custom`;
- preview branch include: только `feature/cloudflare-image-edit`;
- Pages Functions включены.

После создания `feature/nexora-v2-architecture` Pages создал запись запуска, но пометил её `is_skipped=true`, `skip_reason=branch_config`. Следовательно, новый branch не получил Preview deployment. Это не сбой сборки V2: ветка пока не разрешена конфигурацией проекта.

## Worker services

В аккаунте обнаружены два Worker:
- `nexora-ai-visualizer` — отдельный сервис основной среды;
- `nexora-ai-visualizer-preview` — отдельный сервис Preview.

Оба имеют Workers AI binding и binding секрета `NEXORA_ACCESS_KEY`. Значения секретов не запрашивались и не читались.

Preview Worker дополнительно имеет KV binding `TEST_RESULTS` на существующий namespace. Live-код Preview сохраняет результаты по ключам `latest-<slot>` с TTL 24 часа. В GitHub-версии `worker/cloudflare-worker.js` и `wrangler.toml` этот binding и код записи отсутствуют. Значит, live Preview и GitHub source расходятся; при любом будущем деплое необходимо сначала решить, сохраняем ли этот диагностический механизм и как корректно описать binding в конфигурации.

## Сверка генератора

В live Preview Worker подтверждены:
- модель `@cf/black-forest-labs/flux-2-klein-4b`;
- обработка `room_image`, необязательного `style_reference`, `style_name`, `user_prompt`, `variant_index`, размеров изображения;
- три текстовых направления для вариантов.

В live Preview Worker не обнаружены отдельные поля или обработчики для `room_type`, анализа фотографии, проверки соответствия типа помещения и специализированного запрета неподходящей мебели для кухни. В текущем запросе генерации эти функции ещё не реализованы как отдельные этапы.

В live Preview CORS allowlist и regex ориентированы на Pages-hostname старого Preview-проекта. Перед созданием отдельного V2 Preview необходимо явно настроить точный origin нового проекта; не следует расширять доступ до произвольных доменов.

## Следствия для V2

1. Не менять существующий Pages project и его branch filters.
2. Не обновлять существующие Worker services и их секреты/bindings.
3. Для V2 создать новый Pages project с GitHub source, который обслуживает только V2 branch/preview.
4. Создать новый Worker service с собственным точным CORS allowlist и независимыми bindings/secrets.
5. Не подключать старый KV namespace автоматически. Решить отдельно, нужен ли V2 собственный KV или иной способ хранения.
6. Сохранить диагностический TEST_RESULTS mechanism как отдельное решение, не копировать его скрыто.
7. Перед первым deploy проверить, что Pages Function V2 обращается только к V2 Worker URL.
8. После создания выполнить read-only проверку project settings, worker settings и URL routing до тестовой генерации.

## Статус

- [x] Список Pages projects прочитан.
- [x] Настройки существующего Preview Pages project прочитаны.
- [x] Статус branch-trigger для новой ветки проверен: пропуск из-за branch_config.
- [x] Список Worker services прочитан.
- [x] Bindings существующих Worker проверены без чтения секретных значений.
- [x] Live Preview Worker source просмотрен.
- [ ] Создать изолированный Pages project V2.
- [ ] Создать изолированный Worker V2.
- [ ] Проверить маршруты, CORS, bindings и безопасное наличие секретов.
- [ ] Развернуть и протестировать только Preview V2.
