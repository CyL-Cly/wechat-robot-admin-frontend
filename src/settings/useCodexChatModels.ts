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

export const useCodexChatModels = (robotId: number, enabled: boolean) => {
	const { data, loading, refresh } = useRequest(
		async () => {
			const resp = await axios.get<CatalogResponse>('/api/v1/codex/models', {
				params: { id: robotId },
				withCredentials: true,
			});
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
			ready: enabled && robotId > 0,
			refreshDeps: [robotId, enabled],
			onError: () => {
				// Keep the form usable even if the catalog is temporarily down.
			},
		},
	);

	return {
		options: data?.options ?? [SENTINEL],
		defaultModel: data?.defaultModel || 'grok-latest',
		loading,
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
