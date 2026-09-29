export function localizedStudioAIError(locale:"en"|"ru",code:unknown,fallback:unknown){
  const key=typeof code==="string"?code:"";
  if(key.startsWith("provider_")){
    if(locale==="en"&&typeof fallback==="string")return fallback;
    return "OpenAI API отклонил запрос. Проверьте ключ, доступ к модели, биллинг и лимиты проекта.";
  }
  const messages:Record<string,[string,string]>={
    ai_context_too_large:["AI analysis accepts up to 128 KB. Shorten long details or analyse a smaller branch.","AI-анализ принимает не более 128 КБ. Сократите длинные описания или анализируйте меньшую ветвь."],
    stale_context:["The graph changed before analysis began. Run analysis again.","Схема изменилась до начала анализа. Запустите анализ снова."],
    burst_rate_limited:["Too many AI requests. Wait one minute or use the local builder.","Слишком много AI-запросов. Подождите минуту или используйте локальный конструктор."],
    rate_limited:["Your AI planning limit is reached. Try later or use the local builder.","Ваш лимит AI-планирования исчерпан. Попробуйте позже или используйте локальный конструктор."],
    tenant_budget_reached:["The daily AI pilot budget is reached. The local builder remains available.","Дневной бюджет AI-пилота исчерпан. Локальный конструктор остаётся доступен."],
    tenant_capacity_reached:["AI is processing the maximum number of plans. Try again shortly.","AI обрабатывает максимальное число планов. Повторите попытку немного позже."],
    tenant_capacity_unavailable:["AI capacity control is temporarily unavailable. No changes were made.","Контроль AI-мощности временно недоступен. Изменения не внесены."],
    not_configured:["AI planning is not configured on this deployment. Use the local builder.","AI-планирование ещё не настроено в этой версии. Используйте локальный конструктор."],
    refused:["The source could not be converted into a safe graph plan.","Источник не удалось преобразовать в безопасный план схемы."],
    invalid_output:["AI returned a plan that did not pass validation. Analyse again.","AI вернул план, который не прошёл проверку. Запустите анализ снова."],
    incomplete:["AI did not finish the plan. Analyse again.","AI не завершил план. Запустите анализ снова."],
  };
  const translated=messages[key];
  if(translated)return translated[locale==="en"?0:1];
  if(locale==="en"&&typeof fallback==="string")return fallback;
  return locale==="en"?"AI planning is unavailable.":"AI-планирование недоступно.";
}
