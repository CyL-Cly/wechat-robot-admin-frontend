import { useRequest } from 'ahooks';
import axios from 'axios';

export type CodexChatModelOption = { label: string; value: string };

const SENTINEL: CodexChatModelOption = { label: 'codex（使用宿主 config.toml 默认模型）', value: 'codex' };

interface CatalogResponse {
	code?: number;
	message?: string;
	data?: {
		models?: Array<{ id?: string } | string>;
		default_model?: string;
	};
}

export const useCodexChatModels = (
	robotId: number,
	enabled: boolean,
	chatBaseURL?: string,
	chatAPIKey?: string,
) => {
	const { data, loading, error, refresh } = useRequest(
		async () => {
			const resp = await axios.post<CatalogResponse>(
				'/api/v1/codex/models',
				{
					chat_base_url: chatBaseURL || '',
					chat_api_key: chatAPIKey || '',
				},
				{
					params: { id: robotId },
					withCredentials: true,
				},
			);
			if (resp.data?.code && resp.data.code !== 200) {
				throw new Error(resp.data.message || '拉取模型失败');
			}
			const payload = resp.data?.data;
			const raw = payload?.models ?? [];
			const ids: string[] = [];
			const seen = new Set<string>();
			for (const item of raw) {
				const id = typeof item === 'string' ? item : item?.id;
				if (!id || seen.has(id)) {
					continue;
				}
				seen.add(id);
				ids.push(id);
			}
			const options: CodexChatModelOption[] = [SENTINEL, ...ids.map(id => ({ label: id, value: id }))];
			return { options, defaultModel: payload?.default_model || 'grok-latest' };
		},
		{
			ready: enabled && robotId > 0 && chatBaseURL !== undefined,
			refreshDeps: [robotId, enabled, chatBaseURL, chatAPIKey],
			debounceWait: 400,
			onError: () => {
				// Keep the form usable even if the catalog is temporarily down.
			},
		},
	);

	return {
		options: data?.options ?? [SENTINEL],
		defaultModel: data?.defaultModel || 'grok-latest',
		loading,
		error,
		refresh,
	};
};

export const needsOpenAICompatibleCredentials = (values: {
	chat_provider?: string;
	memory_enabled?: boolean;
	chat_room_summary_enabled?: boolean;
	text_embedding_model?: string;
}) => {
	if (values.chat_provider !== 'codex_cli') {
		return true;
	}
	if (values.memory_enabled) {
		return true;
	}
	if (values.chat_room_summary_enabled) {
		return true;
	}
	if (values.text_embedding_model && values.text_embedding_model.trim() !== '') {
		return true;
	}
	return false;
};
