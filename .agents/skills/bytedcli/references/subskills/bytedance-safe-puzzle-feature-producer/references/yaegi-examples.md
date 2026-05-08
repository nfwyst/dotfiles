# 脚本示例库

所有示例都遵循 [`yaegi-template.md`](yaegi-template.md) 的模板,**仅展示 `Process` 函数片段**。

## 1. 脚本特征

从 `room_extra` 特征中解析多个字段,一次产出多个特征:

```yaegi
func Process(ctx context.Context, input map[string]any) (res map[string]any, err error) {
    /*----------start----------*/
	extra, _ := feature.Value(ctx, "room_extra")
	playModes, _ := mapitf.Fr(ctx, extra).Get("linker_play_modes").ToListInt64()
	if playModes == nil {
		playModes = []int64{}
	}

	funcType, _ := mapitf.Fr(ctx, extra).GetAny("statistics", "function_type").ToStr()
	interactionPlayID, _ := mapitf.Fr(ctx, extra).GetAny("game_play", "interaction_play_id").ToInt64()
	isGameCohostRoom, _ := mapitf.Fr(ctx, extra).GetAny("game_play", "pk_play_cohost_started").ToBool()
	playID, _ := mapitf.Fr(ctx, extra).GetAny("game_play", "play_id").ToInt64()
	teamJoinMode, _ := mapitf.Fr(ctx, extra).GetAny("game_play", "team_join_mode").ToInt64()

	return map[string]any{
		"room_link_mic_game_play_list": playModes,
		"room_function_type":           funcType,
		"room_is_interaction_play":     interactionPlayID > 0,
		"is_game_cohost_room":          isGameCohostRoom,
		"is_team_play_room":            playID > 0,
		"team_play_join_mode":          teamJoinMode,
	}, nil
    /*----------end----------*/
}
```

## 2. 数据源特征 - 请求脚本

### 2.1 实体数据源特征
```yaegi
func Process(ctx context.Context, input map[string]any) (res map[string]any, err error) {
    /*----------start----------*/
	roomID, _ := entity.Param(ctx, "room_id")
	return map[string]any{
		"RoomID": roomID,
	}, nil
    /*----------end----------*/
}
```

### 2.2 生产集合数据源特征
```yaegi
func Process(ctx context.Context, input map[string]any) (res map[string]any, err error) {
    /*----------start----------*/
	userID, _ := pkg.Param(ctx, "user_id")
	roomID, _ := pkg.Param(ctx, "room_id")
	objectID, _ := pkg.Param(ctx, "object_id")

	const configKey = "hotsoon_live_audioslice"
	properties := map[string]any{
		"token":      "live_review",
		"uid":        userID,
		"uid_type":   12,
		"device_id":  roomID,
		"uuid":       objectID,
		"app_id":     1112,
		"app_name":   configKey,
		"config_key": configKey,
	}
	jsonProperties, err := json.MarshalString(properties)
	if err != nil {
		return nil, err
	}
	return map[string]any{
		"Properties": jsonProperties,
	}, nil
    /*----------end----------*/
}
```

## 3. 数据源特征 - 结果脚本

### 3.1 实体数据源特征
```yaegi
func Process(ctx context.Context, input map[string]any) (res map[string]any, err error) {
    dsReq := input["dsReq"].(map[string]any)
    dsResp := input["dsResp"].(map[string]any)
    dsErr := input["dsErr"]
    /*----------start----------*/
	if dsErr != nil {
		return nil, dsErr.(error)
	}
	isFlashRoom, _ := dsResp["IsFlashRoom"].(bool)
	return map[string]any{
		"is_flash_room": isFlashRoom,
	}, nil
    /*----------end----------*/
}
```

### 3.2 生产集合数据源特征
```yaegi
func Process(ctx context.Context, input map[string]any) (res map[string]any, err error) {
    dsReq := input["dsReq"].(map[string]any)
    dsResp := input["dsResp"].(map[string]any)
    dsErr := input["dsErr"]
    /*----------start----------*/
	if dsErr != nil {
		return nil, dsErr.(error)
	}
	info, err := mapitf.Fr(ctx, dsResp).Get("info").Index(0).ToMap()
	if err != nil {
		return nil, err
	}

	versions := []string{}
	if versionName, _ := mapitf.Fr(ctx, info).Get("version_name").ToStr(); versionName != "" {
		versions = strings.Split(versionName, ",")
	}

	flagList := []string{}
	if open, err := mapitf.Fr(ctx, info).GetAny("parameters", "open").ToMap(); err == nil {
		flagList = maps.Keys(open).([]string)
	}

	return map[string]any{
		"libra_versions":  versions,
		"libra_flag_list": flagList,
	}, nil
    /*----------end----------*/
}
```
